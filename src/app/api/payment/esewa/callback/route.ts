import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Payment from '@/models/Payment';
import { completeRegistration } from '@/lib/payment';
import crypto from 'crypto';

const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function verifyEsewaSignature(data: string, receivedSignature: string): boolean {
  try {
    const hmac = crypto.createHmac('sha256', ESEWA_SECRET_KEY);
    hmac.update(data);
    const expected = hmac.digest('base64');
    return expected === receivedSignature;
  } catch {
    return false;
  }
}

async function handleCallback(encodedData: string) {
  await dbConnect();

  if (!encodedData) {
    return NextResponse.redirect(new URL('/payment/verify?provider=esewa&status=failed&reason=No+data+received', APP_URL));
  }

  let esewaData: any;
  try {
    esewaData = JSON.parse(Buffer.from(encodedData, 'base64').toString('utf-8'));
  } catch {
    return NextResponse.redirect(new URL('/payment/verify?provider=esewa&status=failed&reason=Invalid+response', APP_URL));
  }

  const { status, transaction_uuid, total_amount, transaction_code, signed_field_names, signature } = esewaData;

  // Verify signature
  if (signed_field_names && signature) {
    const fields = signed_field_names.split(',');
    const message = fields.map((f: string) => `${f}=${esewaData[f]}`).join(',');
    if (!verifyEsewaSignature(message, signature)) {
      return NextResponse.redirect(new URL('/payment/verify?provider=esewa&status=failed&reason=Signature+mismatch', APP_URL));
    }
  }

  // Find payment by purchaseOrderId (= transaction_uuid we sent)
  const payment: any = await Payment.findOne({ purchaseOrderId: transaction_uuid }).lean();

  if (status !== 'COMPLETE') {
    if (payment) await Payment.findByIdAndUpdate(payment._id, { status: 'failed' });
    const eventParam = payment?.eventId ? `&eventId=${payment.eventId}` : '';
    return NextResponse.redirect(new URL(`/payment/verify?provider=esewa&status=failed&reason=${encodeURIComponent(status || 'Payment failed')}${eventParam}`, APP_URL));
  }

  if (!payment) {
    return NextResponse.redirect(new URL('/payment/verify?provider=esewa&status=failed&reason=Payment+not+found', APP_URL));
  }

  if (payment.status === 'completed') {
    return NextResponse.redirect(new URL(`/payment/verify?provider=esewa&status=success&eventId=${payment.eventId}`, APP_URL));
  }

  // Mark payment completed first, then register
  await Payment.findByIdAndUpdate(payment._id, {
    status: 'completed',
    transactionId: transaction_code || transaction_uuid,
    metadata: esewaData,
  });

  await completeRegistration(
    payment._id.toString(),
    payment.userId.toString(),
    payment.eventId.toString()
  );

  return NextResponse.redirect(new URL(`/payment/verify?provider=esewa&status=success&eventId=${payment.eventId}`, APP_URL));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    return await handleCallback(searchParams.get('data') || '');
  } catch (err) {
    console.error('[eSewa callback GET]', err);
    return NextResponse.redirect(new URL('/payment/verify?provider=esewa&status=failed&reason=Server+error', APP_URL));
  }
}

// eSewa v2 also sends server-to-server POST callbacks
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return await handleCallback(body.data || '');
  } catch (err) {
    console.error('[eSewa callback POST]', err);
    return NextResponse.redirect(new URL('/payment/verify?provider=esewa&status=failed&reason=Server+error', APP_URL));
  }
}
