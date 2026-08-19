import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Event from '@/models/Event';
import Registration from '@/models/Registration';
import { sendConfirmationsForEvent } from '@/lib/confirmations';
import { CONFIRMATION_CONFIG } from '@/lib/constants';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'eventId required' }, { status: 400 });
    }

    const event = await Event.findById(eventId)
      .select('title date isActive isCancelled')
      .lean() as any;

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const now = new Date();
    const eventDate = new Date(event.date);
    const daysUntilEvent = (eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);

    const pending = await Registration.countDocuments({
      eventId,
      confirmed: false,
      confirmationEmailSent: false,
    });

    const alreadySent = await Registration.countDocuments({
      eventId,
      confirmed: false,
      confirmationEmailSent: true,
    });

    return NextResponse.json({
      eventTitle: event.title,
      eventDate: event.date,
      daysUntilEvent: Math.round(daysUntilEvent),
      pendingCount: pending,
      alreadySentCount: alreadySent,
      tooFarAway: daysUntilEvent > CONFIRMATION_CONFIG.manualTriggerMaxDays,
    });
  } catch (err) {
    console.error('[GET /api/admin/run-confirmations]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // All POST calls require admin auth — the _autoTriggered bypass is removed
    // because reminders.ts now calls sendConfirmationsForEvent() directly.
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { eventId, force } = body;

    const result = await sendConfirmationsForEvent(
      eventId ?? undefined,
      { force: !!force }
    );

    return NextResponse.json({
      success: true,
      ...result,
      message: `${result.sent} email${result.sent !== 1 ? 's' : ''} sent across ${result.eventsProcessed} event${result.eventsProcessed !== 1 ? 's' : ''}${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
    });
  } catch (err) {
    console.error('[POST /api/admin/run-confirmations]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
