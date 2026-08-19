import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Event from '@/models/Event';
import Registration from '@/models/Registration';
import Payment from '@/models/Payment';
import { sendCancellationEmail } from '@/lib/email';
import mongoose from 'mongoose';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reason } = await req.json();
    if (!reason?.trim()) {
      return NextResponse.json({ error: 'Cancellation reason is required' }, { status: 400 });
    }

    await dbConnect();
    const eventId = params.id;

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (event.isCancelled) return NextResponse.json({ error: 'Event already cancelled' }, { status: 400 });

    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    let refundCount = 0;
    try {
      // 1. Mark event as cancelled
      event.isCancelled = true;
      event.cancelReason = reason;
      event.cancelledAt = new Date();
      await event.save({ session: mongoSession });

      // 2. Find all registrations directly populated
      const registrations: any[] = await Registration.find({ eventId }).populate('userId').lean();

      // 3. Update all completed payments to 'refund_pending'
      const paymentUpdateResult = await Payment.updateMany(
        { eventId, status: 'completed' },
        { $set: { status: 'refund_pending' } },
        { session: mongoSession }
      );
      refundCount = paymentUpdateResult.modifiedCount;

      await mongoSession.commitTransaction();

      // 4. Send emails + push notifications asynchronously
      registrations.forEach((reg: any) => {
        const uid = reg.userId?._id?.toString() || reg.userId?.toString();
        if (uid) {
          void import('@/lib/notifications').then(({ pushNotification }) => {
            pushNotification({
              userId: uid,
              type: 'event_cancelled',
              title: 'Event cancelled',
              body: `${event.title} has been cancelled. Reason: ${reason}`,
              eventId,
              actionUrl: '/my-events',
              actionLabel: 'View my events',
              ttlHours: 72,
            }).catch(err => console.error(err));
          }).catch(err => console.error(err));
        }
        if (reg.userId && reg.userId.email) {
          sendCancellationEmail({
            to: reg.userId.email,
            name: reg.userId.name || 'Student',
            eventName: event.title,
            cancelReason: reason,
          }).catch(err => console.error('[Cancellation Email]', err));
        }
      });

    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }

    return NextResponse.json({ success: true, refundCount });

  } catch (err: any) {
    console.error('[API /admin/events/[id]/cancel]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
