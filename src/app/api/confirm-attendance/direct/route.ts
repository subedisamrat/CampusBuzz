import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Registration from '@/models/Registration';
import User from '@/models/User';
import Event from '@/models/Event';
import { sendRegistrationEmail } from '@/lib/email';
import { generateQRCode } from '@/lib/qr';
import { format } from 'date-fns';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    await dbConnect();
    const { registrationId } = await req.json();
    const userId = session.user.id;

    const registration = await Registration.findOne({ registrationId, userId });
    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    if (!registration.confirmationEmailSent) {
      return NextResponse.json({
        error: 'Confirmation not available yet. Wait for admin to send your confirmation email.',
        code: 'CONFIRMATION_NOT_SENT',
      }, { status: 403 });
    }

    if (registration.confirmTokenExpiry && new Date() > registration.confirmTokenExpiry) {
      return NextResponse.json({
        error: 'Your confirmation window has expired. Please contact the event organiser.',
        code: 'CONFIRMATION_EXPIRED',
      }, { status: 403 });
    }

    if (registration.confirmed) {
      return NextResponse.json({ error: 'Already confirmed.' }, { status: 409 });
    }

    const qrCodeDataUrl = await generateQRCode(
      registration.registrationId,
      registration.eventId.toString(),
      registration.userId.toString()
    );

    // Atomic update: only confirm if still unconfirmed (prevents race condition)
    const updated = await Registration.findOneAndUpdate(
      { _id: registration._id, confirmed: false },
      { $set: { qrCode: qrCodeDataUrl, confirmed: true, confirmToken: undefined } },
      { new: true }
    );
    if (!updated) {
      return NextResponse.json({ error: 'Already confirmed.' }, { status: 409 });
    }

    try {
      const [user, event] = await Promise.all([
        User.findById(userId).select('email name').lean() as any,
        Event.findById(registration.eventId).select('title date venue').lean() as any,
      ]);
      if (user && event) {
        sendRegistrationEmail({
          to: user.email,
          name: user.name,
          eventName: event.title,
          eventDate: format(new Date(event.date), 'PPP'),
          eventVenue: event.venue,
          qrCodeDataUrl,
          registrationId: registration.registrationId,
        }).catch(err => console.error('[Confirm direct] Email failed:', err));
      }
    } catch (err) {
      console.error('[Confirm direct] Email error:', err);
    }

    return NextResponse.json({ success: true, qrCode: qrCodeDataUrl });
  } catch (err) {
    console.error('[ConfirmDirect POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
