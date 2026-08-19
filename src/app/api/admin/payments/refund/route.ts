import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Payment from '@/models/Payment';
import { sendRefundConfirmation } from '@/lib/email';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  try {
    const { paymentId } = await req.json();

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID required' }, { status: 400 });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (payment.status !== 'completed') {
      return NextResponse.json({ error: 'Can only refund completed payments' }, { status: 400 });
    }

    if (payment.status === 'refunded') {
      return NextResponse.json({ error: 'Payment already refunded' }, { status: 400 });
    }

    let refundSuccess = false;

    if (payment.provider === 'khalti') {
      try {
        const khaltiRefund = await fetch('https://dev.khalti.com/api/v2/epayment/refund/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Key ${process.env.KHALTI_SECRET_KEY}`,
          },
          body: JSON.stringify({
            idx: payment.transactionId,
            amount: payment.amount,
          }),
        });

        if (khaltiRefund.ok) {
          refundSuccess = true;
        }
      } catch (err) {
        console.error('[Refund] Khalti refund failed:', err);
      }
    }

    if (payment.provider === 'esewa') {
      refundSuccess = true;
    }

    payment.status = 'refunded';
    payment.refundedAt = new Date();
    payment.refundedBy = session.user.id as unknown as import('mongoose').Types.ObjectId;
    await payment.save();

    // Fire-and-forget: send refund confirmation email to the student
    Payment.findById(payment._id)
      .populate('userId', 'email name')
      .populate('eventId', 'title')
      .lean()
      .then((populated: any) => {
        if (populated?.userId && populated?.eventId) {
          sendRefundConfirmation({
            to: populated.userId.email,
            name: populated.userId.name,
            eventName: populated.eventId.title,
            amount: payment.amount,
            provider: payment.provider,
          });
        }
      })
      .catch((err) => console.error('[Refund] Email population failed:', err));

    return NextResponse.json({
      success: true,
      message: 'Payment refunded successfully',
      externalRefundAttempted: payment.provider === 'khalti',
      externalRefundSuccess: payment.provider === 'khalti' ? refundSuccess : null,
    });
  } catch (err) {
    console.error('[Refund] Error:', err);
    return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 });
  }
}
