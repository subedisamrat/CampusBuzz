import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Registration from '@/models/Registration';
import Event from '@/models/Event';
import User from '@/models/User';
import Waitlist from '@/models/Waitlist';
import QRCode from 'qrcode';
import { sendRegistrationEmail, sendCapacityAlertEmail, sendSpotReleasedEmail } from '@/lib/email';
import { promoteTopWaitlistUser } from '@/lib/algorithms/waitlistManager';
import { updateStudentReliability, getTierBenefits } from '@/lib/ml/reliabilityScoring';
import { logActivity } from '@/lib/activityLog';
import { format } from 'date-fns';
import crypto from 'crypto';
import { TIME_UNITS } from '@/lib/constants';

function generateRegistrationId(): string {
  const unique = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `CP-${unique}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    await dbConnect();
    const { eventId } = await req.json();

    const event: any = await Event.findById(eventId).lean();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    if (event.feeType === 'paid') return NextResponse.json({ error: 'Paid event — use payment flow' }, { status: 400 });

    if (event.date < new Date()) {
      return NextResponse.json({ error: 'This event has already ended' }, { status: 400 });
    }

    const userId = (session.user as { id: string }).id;
    const existing = await Registration.findOne({ userId, eventId }).lean();
    if (existing) return NextResponse.json({ error: 'Already registered' }, { status: 409 });

    // Ban check
    const currentUser = await User.findById(userId).select('isBanned banReason bannedAt').lean();
    if ((currentUser as any)?.isBanned) {
      return NextResponse.json({
        error: 'Your account has been restricted from registering for events.',
        code: 'ACCOUNT_BANNED',
        banReason: (currentUser as any).banReason,
        bannedAt: (currentUser as any).bannedAt,
      }, { status: 403 });
    }

    const user: any = await User.findById(userId).lean();
    const registrationId = generateRegistrationId();

    const userTier = ((user as any)?.engagementTier ?? 'new') as 'champion' | 'regular' | 'new' | 'unreliable';

    const isLastMinute = event.date.getTime() - Date.now() < TIME_UNITS.DAY_MS;
    const tierBenefits = getTierBenefits(userTier);
    const confirmTokenExpiry = new Date(Date.now() + tierBenefits.confirmationWindowHours * 60 * 60 * 1000);

    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
      const eventWithSession = await Event.findById(eventId).session(mongoSession);
      if (!eventWithSession || eventWithSession.registeredCount >= eventWithSession.capacity) {
        await mongoSession.abortTransaction();
        return NextResponse.json({ error: 'Event is full' }, { status: 400 });
      }

      // Option B: no QR yet — QR is generated only after attendance confirmation
      const registration = await Registration.create([{
        userId,
        eventId,
        registrationId,
        qrCode: '',          // empty until confirmed
        checkedIn: false,
        confirmed: false,    // awaiting confirmation 24h before event
        isLastMinute,
        confirmTokenExpiry,
      }], { session: mongoSession });

      await Event.findByIdAndUpdate(
        eventId,
        { $inc: { registeredCount: 1 } },
        { session: mongoSession }
      );

      await mongoSession.commitTransaction();

      // Fire-and-forget capacity alert at 80% and 100%
      void (async () => {
        try {
          const updatedEvent = await Event.findById(eventId)
            .select('title date registeredCount capacity createdBy').lean();
          if (!updatedEvent) return;
          const ev = updatedEvent as any;
          const fill = Math.round((ev.registeredCount / ev.capacity) * 100);
          if (fill !== 80 && fill !== 100) return;
          const creator = await User.findById(ev.createdBy).select('email').lean();
          if (!creator) return;
          const wlCount = fill >= 100
            ? await Waitlist.countDocuments({ eventId })
            : 0;
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
          await sendCapacityAlertEmail({
            adminEmail: (creator as any).email,
            eventName: ev.title,
            eventDate: new Date(ev.date).toLocaleDateString('en-NP', { dateStyle: 'full' } as any),
            registeredCount: ev.registeredCount,
            capacity: ev.capacity,
            fillPercent: fill,
            waitlistCount: wlCount,
            eventAdminUrl: `${appUrl}/admin/events`,
          });
        } catch (err) {
          console.error('[Capacity Alert]', err);
        }
      })();

      // Send a "registration received" email (no QR yet)
      const regId = (registration[0]?._id ?? (registration as any)._id)?.toString();
      void (async () => {
        try {
          await sendRegistrationEmail({
            to: user ? user.email : '',
            name: user ? user.name : '',
            eventName: event.title,
            eventDate: format(event.date, 'PPP'),
            eventVenue: event.venue,
            qrCodeDataUrl: '',
            registrationId,
          });
          // NOTE: Do NOT set confirmationEmailSent here.
          // confirmationEmailSent is only set when admin runs "Run Confirmations"
          // and sends the actual attendance confirmation email with the token.
          // The email sent here is just a "registration received" notice.
        } catch (err) {
          console.error('[Email] Failed to send registration confirmation:', err);
        }
      })();

      // Fire-and-forget reliability scoring update
      void updateStudentReliability(userId).catch(err =>
        console.error('[Reliability] Update after registration failed:', err)
      );

      // Log activity
      void logActivity({
        userId,
        action: 'register',
        eventId,
        eventTitle: event.title,
        details: `Registered for ${event.title}`,
      }).catch(err => console.error(err));

      // Never expose registrationId for unconfirmed free registrations
      // A student must confirm via email before they can check in
      return NextResponse.json({
        success: true,
        pendingConfirmation: true,
        registrationId,
        message: 'Registration received. Check your email to confirm your attendance.',
      }, { status: 201 });
    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    await dbConnect();
    const { eventId } = await req.json();
    const userId = (session.user as { id: string }).id;

    const registration = await Registration.findOne({ userId, eventId }).lean();
    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
      await Registration.deleteOne({ userId, eventId }, { session: mongoSession });
      await Event.findByIdAndUpdate(eventId, { $inc: { registeredCount: -1 } }, { session: mongoSession });
      await mongoSession.commitTransaction();
    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }

    // Fire-and-forget: promote the top waitlist user now that a spot opened
    promoteTopWaitlistUser(eventId).catch(err =>
      console.error('[Waitlist] Promotion after cancel failed:', err)
    );

    void import('@/lib/ml/reliabilityScoring').then(({ updateStudentReliability }) => {
      updateStudentReliability(userId)
        .catch(err => console.error('[Reliability] Post-cancel update failed:', err));
    }).catch(err => console.error(err));

    // Log activity
    void (async () => {
      try {
        const ev = await Event.findById(eventId).select('title').lean() as any;
        void logActivity({
          userId,
          action: 'cancel',
          eventId,
          eventTitle: ev?.title ?? '',
          details: `Cancelled registration for ${ev?.title ?? 'event'}`,
        });
      } catch {}
    })();

    // Fire-and-forget: send spot released email to the cancelled student
    void (async () => {
      try {
        const [cancelledUser, cancelledEvent] = await Promise.all([
          User.findById(userId).select('email name').lean() as any,
          Event.findById(eventId).select('title date').lean() as any,
        ]);
        if (cancelledUser?.email && cancelledEvent) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
          await sendSpotReleasedEmail({
            to: cancelledUser.email,
            name: cancelledUser.name,
            eventName: cancelledEvent.title,
            eventDate: format(new Date(cancelledEvent.date), 'PPP'),
            eventUrl: `${appUrl}/events/${eventId}`,
            reason: 'manual_cancel',
          });
        }
      } catch (err) {
        console.error('[Spot Release] Email failed:', err);
      }
    })();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const userId = (session.user as { id: string }).id;
    const registrations: any = await Registration.find({ userId }).populate('eventId').lean();
    return NextResponse.json(registrations);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
