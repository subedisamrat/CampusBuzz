import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Registration from '@/models/Registration';
import User from '@/models/User';
import Event from '@/models/Event';
import QRCode from 'qrcode';
import { sendRegistrationEmail, sendSpotReleasedEmail } from '@/lib/email';
import { promoteTopWaitlistUser } from '@/lib/algorithms/waitlistManager';
import { format } from 'date-fns';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL('/my-events?confirm=invalid', APP_URL));
    }

    await dbConnect();

    const registration = await Registration.findOne({ confirmToken: token });
    if (!registration) {
      return NextResponse.redirect(new URL('/my-events?confirm=invalid', APP_URL));
    }

    if (registration.confirmTokenExpiry && new Date() > registration.confirmTokenExpiry) {
      const dbSession = await mongoose.startSession();
      dbSession.startTransaction();
      try {
        await Registration.deleteOne({ _id: registration._id }, { session: dbSession });
        await Event.findByIdAndUpdate(
          registration.eventId,
          { $inc: { registeredCount: -1 } },
          { session: dbSession }
        );
        await dbSession.commitTransaction();
      } catch (txErr) {
        await dbSession.abortTransaction();
        console.error('[confirm-attendance] Expiry cleanup failed:', txErr);
      } finally {
        dbSession.endSession();
      }

      void promoteTopWaitlistUser(registration.eventId.toString()).catch(err =>
        console.error('[Waitlist] Promotion after token expiry failed:', err)
      );

      void import('@/lib/ml/reliabilityScoring').then(({ updateStudentReliability }) => {
        updateStudentReliability(registration.userId.toString())
          .catch(err => console.error('[Reliability] Post-expiry update failed:', err));
      }).catch(err => console.error(err));

      void (async () => {
        try {
          const [expiredUser, expiredEvent] = await Promise.all([
            User.findById(registration.userId).select('email name').lean() as any,
            Event.findById(registration.eventId).select('title date').lean() as any,
          ]);
          if (expiredUser?.email && expiredEvent) {
            await sendSpotReleasedEmail({
              to: expiredUser.email,
              name: expiredUser.name,
              eventName: expiredEvent.title,
              eventDate: format(new Date(expiredEvent.date), 'PPP'),
              eventUrl: `${APP_URL}/events/${registration.eventId}`,
              reason: 'token_expired',
            });
          }
        } catch (err) {
          console.error('[Spot Release] Email failed:', err);
        }
      })();

      return NextResponse.redirect(
        new URL(`/events/${registration.eventId}?released=true`, process.env.NEXTAUTH_URL ?? 'http://localhost:3000')
      );
    }

    if (registration.confirmed) {
      return NextResponse.redirect(
        new URL(`/confirm-success?registrationId=${registration.registrationId}`,
          process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
        )
      );
    }

    const qrData = JSON.stringify({
      registrationId: registration.registrationId,
      eventId: registration.eventId.toString(),
      userId: registration.userId.toString(),
    });
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'H',
    });

    registration.qrCode = qrCodeDataUrl;
    registration.confirmed = true;
    registration.confirmToken = undefined;
    await registration.save();

    try {
      const [user, event] = await Promise.all([
        User.findById(registration.userId).select('email name').lean() as any,
        Event.findById(registration.eventId).select('title date venue').lean() as any,
      ]);

      if (user && event) {
        await sendRegistrationEmail({
          to: user.email,
          name: user.name,
          eventName: event.title,
          eventDate: format(new Date(event.date), 'PPP'),
          eventVenue: event.venue,
          qrCodeDataUrl,
          registrationId: registration.registrationId,
        });
      }
    } catch (err) {
      console.error('[Confirm] Email send failed:', err);
    }

    return NextResponse.redirect(
      new URL(`/confirm-success?registrationId=${registration.registrationId}`,
        process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
      )
    );
  } catch (err) {
    console.error('[ConfirmAttendance GET]', err);
    return NextResponse.redirect(new URL('/my-events?confirm=error', APP_URL));
  }
}
