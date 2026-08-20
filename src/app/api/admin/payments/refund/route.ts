import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Payment from '@/models/Payment';
import { sendRefundConfirmation } from '@/lib/email';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

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

    let refundSuccess = false;

    if (payment.provider === 'khalti') {
      try {
        const khaltiApiUrl = process.env.KHALTI_API_URL || 'https://dev.khalti.com/api/v2';
        const khaltiRefund = await fetch(`${khaltiApiUrl}/epayment/refund/`, {
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
        } else {
          const errorBody = await khaltiRefund.text().catch(() => '');
          console.error('[Refund] Khalti API rejected refund:', khaltiRefund.status, errorBody);
        }
      } catch (err) {
        console.error('[Refund] Khalti refund failed:', err);
      }

      if (!refundSuccess) {
        return NextResponse.json({
          error: 'Khalti refund failed. Payment NOT marked as refunded.',
          khaltiStatus: 'failed',
        }, { status: 400 });
      }
    }

    if (payment.provider === 'esewa') {
      // eSewa refund requires manual processing — mark as refund_pending for admin follow-up
      payment.status = 'refund_pending';
      payment.refundedAt = new Date();
      payment.refundedBy = session.user.id as unknown as import('mongoose').Types.ObjectId;
      await payment.save();

      return NextResponse.json({
        success: true,
        message: 'eSewa refund requires manual processing. Payment marked as refund_pending.',
        externalRefundAttempted: false,
        externalRefundSuccess: null,
      });
    }

    // Khalti (already verified success above) — mark as refunded
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
