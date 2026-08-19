import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import EventInterest from '@/models/EventInterest';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ entries: [] });

    await dbConnect();

    const entries = await EventInterest.find({ userId: session.user.id })
      .populate('eventId', 'title date venue capacity registeredCount feeType feeAmount')
      .sort({ createdAt: -1 })
      .lean();

    const enriched = entries.map(entry => ({
      ...entry,
      eventId: (entry.eventId as any)?._id?.toString() || entry.eventId.toString(),
      event: entry.eventId,
    }));

    return NextResponse.json({ entries: enriched });
  } catch (err) {
    console.error('[EventInterest My GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
