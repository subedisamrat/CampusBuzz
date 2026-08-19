import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Registration from '@/models/Registration';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const registrationId = searchParams.get('registrationId');
    if (!registrationId) return NextResponse.json({ error: 'Missing registrationId' }, { status: 400 });

    await dbConnect();
    const userId = (session.user as { id: string }).id;

    const registration = await Registration.findOne({ registrationId, userId })
      .populate('eventId', 'title endDate')
      .lean() as any;

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const event = registration.eventId as any;
    const now = new Date();

    // Status determination — priority order
    let status: 'PENDING' | 'CHECKED_IN' | 'FLAGGED_PENDING_REVIEW' | 'BLOCKED' | 'QR_EXPIRED';

    if (registration.checkedIn) {
      status = 'CHECKED_IN';
    } else if (registration.flagged && registration.anomalyScore && registration.anomalyScore >= 0.8) {
      status = 'BLOCKED';
    } else if (registration.flagged) {
      status = 'FLAGGED_PENDING_REVIEW';
    } else if (event?.endDate && new Date(event.endDate) < now) {
      status = 'QR_EXPIRED';
    } else {
      status = 'PENDING';
    }

    return NextResponse.json({
      status,
      qrCode: registration.qrCode ?? null,
      checkedInAt: registration.checkedInAt ?? null,
      eventTitle: event?.title ?? null,
      // Never expose anomalyScore or flagReason to student
    }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
