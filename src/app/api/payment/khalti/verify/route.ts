import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Payment from '@/models/Payment';
import { verifyKhaltiPayment, completeRegistration } from '@/lib/payment';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    await dbConnect();
    const { paymentId, pidx, transactionId, amount } = await req.json();

    const payment: any = await Payment.findById(paymentId).lean();
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (payment.status === 'completed') {
      return NextResponse.json({ success: true, message: 'Payment already verified' });
    }

    const userId = session.user.id;
    const eventId = payment.eventId.toString();

    const verified = await verifyKhaltiPayment(pidx, transactionId, amount);

    if (!verified) {
      await Payment.findByIdAndUpdate(paymentId, { status: 'failed' });
      return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 400 });
    }

    await completeRegistration(paymentId, userId, eventId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API /payment/khalti/verify]', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
