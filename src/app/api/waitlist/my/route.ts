import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Waitlist from '@/models/Waitlist';
import Event from '@/models/Event';
import { getWaitlistPosition } from '@/lib/algorithms/waitlistManager';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ entries: [] });

    await dbConnect();
    const userId = session.user.id;

    const rawEntries: any = await Waitlist.find({ userId, abandonedAt: null })
      .populate('eventId', 'title date venue capacity registeredCount feeType feeAmount')
      .sort({ joinedAt: -1 })
      .lean();

    const seen = new Set<string>();
    const uniqueEntries = rawEntries.filter((entry: any) => {
      const eid = (entry.eventId as any)?._id?.toString() ?? entry.eventId.toString();
      if (seen.has(eid)) return false;
      seen.add(eid);
      return true;
    });

    const enriched = await Promise.all(uniqueEntries.map(async (entry: any) => {
      const eid = (entry.eventId as any)?._id?.toString() ?? entry.eventId.toString();

      const posData = await getWaitlistPosition(eid, userId);
      const position = posData?.position ?? 1;
      const queueLength = posData?.queueLength ?? 1;

      return {
        ...entry,
        eventId: eid,
        event: entry.eventId,
        position,
        queueLength,
      };
    }));

    return NextResponse.json({ entries: enriched });
  } catch (err) {
    console.error('[Waitlist My GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
