import Payment from '@/models/Payment';
import User from '@/models/User';
import Event from '@/models/Event';
import Registration from '@/models/Registration';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { sendPaymentConfirmation } from '@/lib/email';

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 150
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isTransient =
        err?.errorLabels?.includes('TransientTransactionError') ||
        err?.code === 112 ||
        err?.codeName === 'WriteConflict';

      if (!isTransient || attempt === retries - 1) throw err;

      await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      console.log(`[Payment] Retrying transaction (attempt ${attempt + 2}/${retries})`);
    }
  }
  throw new Error('Max retries exceeded');
}

const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || '';
const KHALTI_API_URL = process.env.KHALTI_API_URL || 'https://dev.khalti.com/api/v2';
const KHALTI_VERIFY_URL = 'https://dev.khalti.com/api/v2/epayment/lookup/';

const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY || '';
const ESEWA_MERCHANT_ID = process.env.ESEWA_MERCHANT_ID || '';
const ESEWA_API_URL = process.env.ESEWA_API_URL || 'https://uat.esewa.com.np';

export interface PaymentInitResult {
  success: boolean;
  paymentId: string;
  amount: number;
  productIdentity: string;
  productName: string;
  provider: 'esewa' | 'khalti';
  signature?: string;
  khaltiConfig?: {
    publicKey: string;
    amount: number;
    productIdentity: string;
    productName: string;
    productUrl: string;
    additionalData: Record<string, any>;
  };
  esewaConfig?: {
    amount: number;
    taxAmount: number;
    totalAmount: number;
    productIdentity: string;
    productName: string;
    merchantId: string;
    merchantSecret: string;
    merchantCallbackUrl: string;
  };
}

export async function initializePayment(
  userId: string,
  eventId: string,
  provider: 'esewa' | 'khalti'
): Promise<PaymentInitResult> {
  const event = await Event.findById(eventId);
  if (!event) throw new Error('Event not found');
  
  if (event.feeType !== 'paid') throw new Error('Event is free');
  
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const amount = event.feeAmount;
  const purchaseOrderId = `PO-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const purchaseOrderName = `Registration: ${event.title}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const payment = await Payment.create({
    userId,
    eventId,
    amount,
    provider,
    status: 'pending',
    purchaseOrderId,
    purchaseOrderName,
    metadata: { userEmail: user.email },
  });

  if (provider === 'khalti') {
    // Khalti v2 e-payment: initiate on server, redirect user to Khalti-hosted page
    const khaltiRes = await fetch(`${KHALTI_API_URL}/epayment/initiate/`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        return_url: `${appUrl}/payment/verify?provider=khalti&eventId=${eventId}`,
        website_url: appUrl,
        amount: amount * 100, // paisa
        purchase_order_id: purchaseOrderId,
        purchase_order_name: purchaseOrderName,
        customer_info: {
          name: user.name,
          email: user.email,
        },
      }),
    });

    if (!khaltiRes.ok) {
      const err = await khaltiRes.json();
      console.error('[Khalti initiate]', err);
      throw new Error('Failed to initiate Khalti payment');
    }

    const khaltiData = await khaltiRes.json();

    // Store pidx for later verification
    await Payment.findByIdAndUpdate(payment._id, {
      metadata: { ...payment.metadata as object, pidx: khaltiData.pidx },
    });

    return {
      success: true,
      paymentId: payment._id.toString(),
      amount,
      productIdentity: purchaseOrderId,
      productName: purchaseOrderName,
      provider: 'khalti',
      // payment_url is where we redirect the user
      khaltiConfig: {
        publicKey: process.env.KHALTI_PUBLIC_KEY || '',
        amount: amount * 100,
        productIdentity: purchaseOrderId,
        productName: purchaseOrderName,
        productUrl: `${appUrl}/events/${eventId}`,
        additionalData: {
          payment_url: khaltiData.payment_url,
          pidx: khaltiData.pidx,
        },
      },
    };
  } else {
    // eSewa v2: generate signature server-side with the transaction_uuid we control
    const transactionUuid = purchaseOrderId; // use purchaseOrderId as the uuid for consistency
    const signature = generateEsewaSignature(String(amount), transactionUuid);

    return {
      success: true,
      paymentId: payment._id.toString(),
      amount,
      productIdentity: purchaseOrderId,
      productName: purchaseOrderName,
      provider: 'esewa',
      signature,
      esewaConfig: {
        amount,
        taxAmount: 0,
        totalAmount: amount,
        productIdentity: purchaseOrderId,
        productName: purchaseOrderName,
        merchantId: ESEWA_MERCHANT_ID,
        merchantSecret: ESEWA_SECRET_KEY,
        merchantCallbackUrl: `${appUrl}/api/payment/esewa/callback`,
      },
    };
  }
}

function generateEsewaSignature(totalAmount: string, transactionUuid: string): string {
  // eSewa v2 HMAC-SHA256: message = "total_amount=X,transaction_uuid=Y,product_code=Z"
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${ESEWA_MERCHANT_ID}`;
  const hmac = crypto.createHmac('sha256', ESEWA_SECRET_KEY);
  hmac.update(message);
  return hmac.digest('base64');
}

export async function verifyKhaltiPayment(pidx: string, transactionId: string, amount: number): Promise<boolean> {
  try {
    const response = await fetch(KHALTI_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idx: pidx,
      }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    
    if (data.status !== 'Completed') return false;
    if (data.amount !== amount) return false;

    await Payment.findOneAndUpdate(
      { purchaseOrderId: data.purchase_order_id },
      {
        status: 'completed',
        transactionId: data.idx,
        metadata: data,
      }
    );

    return true;
  } catch (error) {
    console.error('[Payment] Khalti verification failed:', error);
    return false;
  }
}

export async function verifyEsewaPayment(
  refId: string,
  purchaseOrderId: string,
  amount: string
): Promise<boolean> {
  try {
    const response = await fetch(`${ESEWA_API_URL}/epay/transaction/status/?`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const params = new URLSearchParams({
      merchantId: ESEWA_MERCHANT_ID,
      scd: 'EPAYTEST',
      rid: refId,
      prn: purchaseOrderId,
    });

    const verifyResponse = await fetch(`${ESEWA_API_URL}/epay/transaction/status/?${params}`);
    const data = await verifyResponse.json();

    if (data.status !== 'Complete') return false;

    await Payment.findOneAndUpdate(
      { purchaseOrderId },
      {
        status: 'completed',
        transactionId: data.refId,
        metadata: data,
      }
    );

    return true;
  } catch (error) {
    console.error('[Payment] eSewa verification failed:', error);
    return false;
  }
}

export async function completeRegistration(paymentId: string, userId: string, eventId: string): Promise<void> {
  // Check if registration already exists for this user+event (idempotent)
  const existingReg = await Registration.findOne({ userId, eventId });
  if (existingReg) {
    // Already registered — update with QR and payment info if not set
    if (!existingReg.qrCode) {
      const QRCode = await import('qrcode');
      const qrData = JSON.stringify({ registrationId: existingReg.registrationId, eventId, userId });
      const qrCode = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'H',
      });
      await Registration.findByIdAndUpdate(existingReg._id, {
        qrCode,
        confirmed: true,
        paymentId,
      });
    } else {
      await Registration.findByIdAndUpdate(existingReg._id, {
        paymentId,
      });
    }
    await Payment.findByIdAndUpdate(paymentId, {
      registrationId: existingReg._id,
      status: 'completed',
    });
    console.log('[completeRegistration] Registration already exists, skipping duplicate creation');
    return;
  }

  await withRetry(async () => {
    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment || payment.status !== 'completed') {
        throw new Error('Payment not completed');
      }

      const event = await Event.findById(eventId).session(mongoSession);
      if (!event || event.registeredCount >= event.capacity) {
        throw new Error('Event is full');
      }

      const registrationId = `CP-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
      const QRCode = await import('qrcode');
      const qrData = JSON.stringify({ registrationId, eventId, userId });
      const qrCode = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'H',
      });

      const registration = await Registration.findOneAndUpdate(
        { userId, eventId },
        {
          $setOnInsert: {
            userId,
            eventId,
            registrationId,
            qrCode,
            checkedIn: false,
            confirmed: true,
            paymentId: payment._id,
          },
        },
        { upsert: true, session: mongoSession, new: true }
      );

      await Event.findByIdAndUpdate(
        eventId,
        { $inc: { registeredCount: 1 } },
        { session: mongoSession }
      );

      await Payment.findByIdAndUpdate(paymentId, {
        registrationId: registration._id,
      }, { session: mongoSession });

      await mongoSession.commitTransaction();
      const user = await User.findById(userId).lean() as any;
      if (user) {
        sendPaymentConfirmation({
          to: user.email,
          name: user.name,
          eventName: event.title,
          amount: payment.amount,
          provider: payment.provider,
          transactionId: payment.transactionId,
          qrCodeDataUrl: registration.qrCode,
          registrationId: registration.registrationId,
        }).catch(err => console.error('[Email] Payment confirmation failed:', err));

        // Push payment confirmed notification
        void import('@/lib/notifications').then(({ pushNotification }) => {
          pushNotification({
            userId,
            type: 'payment_confirmed',
            title: '💳 Payment confirmed',
            body: `Your payment for ${event.title} is confirmed. Your QR code has been emailed.`,
            eventId,
            registrationId: registration.registrationId,
            actionUrl: `/my-events/checkin/${registration.registrationId}`,
            actionLabel: 'Open ticket',
            ttlHours: 48,
          }).catch(err => console.error(err));
        }).catch(err => console.error(err));
      }
    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }
  });
}

export async function getPaymentHistory(userId: string) {
  return Payment.find({ userId })
    .populate('eventId', 'title date venue')
    .sort({ createdAt: -1 })
    .lean();
}

export async function getPaymentById(paymentId: string) {
  return Payment.findById(paymentId)
    .populate('eventId', 'title date venue')
    .populate('userId', 'name email');
}
