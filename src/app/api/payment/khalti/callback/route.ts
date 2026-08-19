import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Payment from '@/models/Payment';
import { completeRegistration } from '@/lib/payment';

const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || '';
const KHALTI_API_URL = process.env.KHALTI_API_URL || 'https://dev.khalti.com/api/v2';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Khalti v2 sends: pidx, status, purchase_order_id, purchase_order_name,
  //                  transaction_id, tidx, amount, mobile, total_amount
  const pidx = searchParams.get('pidx');
  const status = searchParams.get('status');
  const purchaseOrderId = searchParams.get('purchase_order_id');
  const transactionId = searchParams.get('transaction_id') || searchParams.get('tidx');

  console.log('[Khalti callback] status:', status, 'order:', purchaseOrderId?.slice(0, 8));

  await dbConnect();

  if (!purchaseOrderId) {
    console.error('[Khalti callback] Missing purchase_order_id');
    return NextResponse.redirect(new URL('/payment/failed?reason=Missing+order+ID', APP_URL));
  }

  // Find payment by purchaseOrderId
  const payment: any = await Payment.findOne({ purchaseOrderId }).lean();
  if (!payment) {
    console.error('[Khalti callback] Payment not found for purchaseOrderId:', purchaseOrderId);
    return NextResponse.redirect(new URL('/payment/failed?reason=Payment+not+found', APP_URL));
  }

  // Already completed — idempotent
  if (payment.status === 'completed') {
    return NextResponse.redirect(new URL('/my-events?payment=success', APP_URL));
  }

  // User cancelled or payment failed at Khalti
  if (status !== 'Completed') {
    await Payment.findByIdAndUpdate(payment._id, { status: 'failed' });
    return NextResponse.redirect(
      new URL(`/payment/failed?reason=${encodeURIComponent(status || 'Payment cancelled')}&eventId=${payment.eventId}`, APP_URL)
    );
  }

  // Verify with Khalti lookup API using pidx
  try {
    const lookupRes = await fetch(`${KHALTI_API_URL}/epayment/lookup/`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pidx }),
    });

    const lookupData = await lookupRes.json();
    console.log('[Khalti lookup] status:', lookupData.status);

    if (!lookupRes.ok || lookupData.status !== 'Completed') {
      await Payment.findByIdAndUpdate(payment._id, { status: 'failed' });
      return NextResponse.redirect(
        new URL(`/payment/failed?reason=${encodeURIComponent(lookupData.status || 'Verification failed')}`, APP_URL)
      );
    }

    // Mark payment completed with transaction details
    await Payment.findByIdAndUpdate(payment._id, {
      status: 'completed',
      transactionId: transactionId || lookupData.transaction_id || pidx,
      metadata: lookupData,
    });

    // Create registration atomically
    await completeRegistration(
      payment._id.toString(),
      payment.userId.toString(),
      payment.eventId.toString()
    );

    return NextResponse.redirect(new URL('/my-events?payment=success', APP_URL));
  } catch (err) {
    console.error('[Khalti callback] error:', err);
    await Payment.findByIdAndUpdate(payment._id, { status: 'failed' });
    return NextResponse.redirect(new URL(`/payment/failed?reason=Server+error&eventId=${payment.eventId}`, APP_URL));
  }
}
