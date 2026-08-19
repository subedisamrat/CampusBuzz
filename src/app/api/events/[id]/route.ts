import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Event from '@/models/Event';
import Registration from '@/models/Registration';
import Payment from '@/models/Payment';
import EventInterest from '@/models/EventInterest';
import User from '@/models/User';
import { sendCancellationEmail, sendCapacityIncreaseNotification } from '@/lib/email';
import { format } from 'date-fns';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbConnect();
    const event = (await Event.findById(params.id).lean()) as any;
    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(event);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const body = await req.json();

    const currentEvent: any = await Event.findById(params.id).lean();
    if (!currentEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (body.capacity !== undefined) {
      if (body.capacity < currentEvent.registeredCount) {
        return NextResponse.json({
          error: `Capacity cannot be set below current registrations (${currentEvent.registeredCount})`
        }, { status: 400 });
      }
    }

    if (body.date !== undefined) {
      const newDate = new Date(body.date);
      const now = new Date();
      if (newDate < now) {
        return NextResponse.json({ error: 'Event date cannot be in the past' }, { status: 400 });
      }
    }

    if (body.date && body.endDate) {
      if (new Date(body.endDate) <= new Date(body.date)) {
        return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
      }
    } else if (body.endDate && !body.date) {
      if (new Date(body.endDate) <= currentEvent.date) {
        return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
      }
    }

    const event = await Event.findByIdAndUpdate(params.id, body, { new: true });

    // If capacity was increased
    if (body.capacity !== undefined && body.capacity > currentEvent.capacity) {
      if (currentEvent.feeType === 'paid') {
        // Notify interested users
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        EventInterest.find({ eventId: params.id })
          .populate('userId', 'email name')
          .lean()
          .then(async (interests: any[]) => {
            for (const interest of interests) {
              const user = interest.userId as any;
              if (!user?.email) continue;
              await sendCapacityIncreaseNotification({
                to: user.email,
                name: user.name,
                eventName: event.title,
                eventDate: format(new Date(event.date), 'PPP'),
                eventVenue: event.venue,
                eventUrl: `${appUrl}/events/${params.id}`,
                eventId: params.id,
                feeAmount: event.feeAmount ?? 0,
              }).catch(err => console.error(err));
            }
          })
          .catch(err => console.error('[Capacity increase] notification error:', err));
      } else {
        // Auto-promote waitlisted students for free events
        void import('@/lib/algorithms/waitlistManager')
          .then(({ promoteForCapacityIncrease }) => {
            promoteForCapacityIncrease(params.id, body.capacity)
              .then(count => {
                if (count > 0) console.log(`[Waitlist] Auto-promoted ${count} students after capacity increase`);
              })
              .catch(err => console.error('[Waitlist] Auto-promote failed:', err));
          });
      }
    }

    return NextResponse.json(event);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    let cancelReason = '';
    try {
      const body = await req.json();
      cancelReason = body?.cancelReason ?? '';
    } catch {
      // body is optional
    }

    const event = await Event.findById(params.id);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Mark event as cancelled
    event.isCancelled = true;
    event.isActive = false;
    event.cancelledAt = new Date();
    event.cancelReason = cancelReason;
    await event.save();

    // Refund all completed payments for this event
    await Payment.updateMany(
      { eventId: params.id, status: 'completed' },
      {
        $set: {
          status: 'refunded',
          refundedAt: new Date(),
          refundedBy: (session.user as { id?: string }).id,
        },
      }
    );

    // Fire-and-forget: send cancellation emails to all registered students
    Registration.find({ eventId: params.id })
      .populate('userId', 'email name')
      .lean()
      .then((registrations: any[]) => {
        for (const reg of registrations) {
          const user = reg.userId as unknown as { email: string; name: string } | null;
          if (user?.email) {
            sendCancellationEmail({
              to: user.email,
              name: user.name ?? 'Student',
              eventName: event.title,
              cancelReason,
            }).catch((err) => console.error('[Email] cancellation email error:', err));
          }
        }
      })
      .catch((err) => console.error('[Cancellation] failed to fetch registrations for email:', err));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
