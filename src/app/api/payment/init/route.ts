import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { initializePayment } from '@/lib/payment';
import Event from '@/models/Event';
import Payment from '@/models/Payment';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    await dbConnect();
    const { eventId, provider } = await req.json();

    if (!eventId || !provider) {
      return NextResponse.json({ error: 'eventId and provider required' }, { status: 400 });
    }

    if (!['esewa', 'khalti'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid payment provider' }, { status: 400 });
    }

    // Guard: event must exist and be a paid event
    const event: any = await Event.findById(eventId).lean();
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (event.feeType !== 'paid') {
      return NextResponse.json({ error: 'Free events do not require payment' }, { status: 400 });
    }

    // Guard: event must have capacity
    if (event.registeredCount >= event.capacity) {
      return NextResponse.json({ error: 'Event is full — use Notify Me to be alerted when spots open' }, { status: 400 });
    }

    // Guard: student must not already have a completed payment for this event
    const existingPayment = await Payment.findOne({
      userId: session.user.id,
      eventId,
      status: 'completed',
    }).lean() as any;
    if (existingPayment) {
      return NextResponse.json({ error: 'Already registered for this event' }, { status: 409 });
    }

    const result = await initializePayment(session.user.id, eventId, provider);
    
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API /payment/init]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
