import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Payment from '@/models/Payment';
import { completeRegistration } from '@/lib/payment';
import crypto from 'crypto';

const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || '';
const KHALTI_API_URL = process.env.KHALTI_API_URL || 'https://dev.khalti.com/api/v2';
const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY || '';

function verifyEsewaSignature(dataStr: string, receivedSignature: string): boolean {
  try {
    const hmac = crypto.createHmac('sha256', ESEWA_SECRET_KEY);
    hmac.update(dataStr);
    const expected = hmac.digest('base64');
    return expected === receivedSignature;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const { provider } = body;

    if (provider === 'khalti') {
      const { pidx, status, purchase_order_id, transaction_id, tidx } = body;
      const idToFind = purchase_order_id;
      
      if (!idToFind && !pidx) {
        return NextResponse.json({ success: false, error: 'Missing payment parameters' }, { status: 400 });
      }

      const payment: any = await Payment.findOne({ $or: [{ purchaseOrderId: idToFind }, { 'metadata.pidx': pidx }] }).lean();
      if (!payment) return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
      if (payment.status === 'completed') return NextResponse.json({ success: true, eventId: payment.eventId });

      if (status && status.toLowerCase() !== 'completed') {
        await Payment.findByIdAndUpdate(payment._id, { status: 'failed' });
        return NextResponse.json({ success: false, error: 'Payment cancelled or failed' }, { status: 400 });
      }

      // Khalti API Lookup
      const lookupRes = await fetch(`${KHALTI_API_URL}/epayment/lookup/`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${KHALTI_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pidx }),
      });
      const lookupData = await lookupRes.json();

      if (!lookupRes.ok || lookupData.status !== 'Completed') {
        await Payment.findByIdAndUpdate(payment._id, { status: 'failed' });
        return NextResponse.json({ success: false, error: lookupData.status || 'Verification failed' }, { status: 400 });
      }

      const txId = transaction_id || tidx || lookupData.transaction_id || pidx;
      await Payment.findByIdAndUpdate(payment._id, {
        status: 'completed',
        transactionId: txId,
        metadata: lookupData,
      });

      await completeRegistration(payment._id.toString(), payment.userId.toString(), payment.eventId.toString());
      return NextResponse.json({ success: true, eventId: payment.eventId });

    } else if (provider === 'esewa') {
      const { data } = body;
      if (!data) return NextResponse.json({ success: false, error: 'No data received' }, { status: 400 });

      let esewaData: any;
      try {
        esewaData = JSON.parse(Buffer.from(data, 'base64').toString('utf-8'));
      } catch {
        return NextResponse.json({ success: false, error: 'Invalid response format' }, { status: 400 });
      }

      const { status, transaction_uuid, total_amount, transaction_code, signed_field_names, signature } = esewaData;

      if (signed_field_names && signature) {
        // Build message exactly as signed_field_names order dictates
        const fields = signed_field_names.split(',');
        const message = fields.map((f: string) => `${f}=${esewaData[f]}`).join(',');
        if (!verifyEsewaSignature(message, signature)) {
          return NextResponse.json({ success: false, error: 'Signature mismatch' }, { status: 400 });
        }
      }

      const payment: any = await Payment.findOne({ purchaseOrderId: transaction_uuid }).lean();
      if (!payment) return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
      if (payment.status === 'completed') return NextResponse.json({ success: true, eventId: payment.eventId });

      if (status !== 'COMPLETE') {
        await Payment.findByIdAndUpdate(payment._id, { status: 'failed' });
        return NextResponse.json({ success: false, error: status || 'Payment failed' }, { status: 400 });
      }

      await Payment.findByIdAndUpdate(payment._id, {
        status: 'completed',
        transactionId: transaction_code || transaction_uuid,
        metadata: esewaData,
      });

      await completeRegistration(payment._id.toString(), payment.userId.toString(), payment.eventId.toString());
      return NextResponse.json({ success: true, eventId: payment.eventId });
      
    } else {
      return NextResponse.json({ success: false, error: 'Invalid provider' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[Verify API error]', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
