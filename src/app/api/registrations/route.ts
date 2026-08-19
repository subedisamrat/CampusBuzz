import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Registration from '@/models/Registration';
import Waitlist from '@/models/Waitlist';
import { getWaitlistPosition } from '@/lib/algorithms/waitlistManager';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const userId = (session.user as { id: string }).id;

    const registrations = await Registration.find({ userId })
      .populate('eventId', 'title date venue category registeredCount capacity feeType feeAmount')
      .sort({ createdAt: -1 })
      .lean();

    const waitlists = await Waitlist.find({ userId })
      .populate('eventId', 'title date venue category registeredCount capacity feeType feeAmount')
      .sort({ joinedAt: -1 })
      .lean();

    const waitlistWithPositions = await Promise.all(waitlists.map(async (wl: any) => {
      if (!wl.eventId) return { ...wl, position: 0, queueLength: 0 };
      const posData = await getWaitlistPosition(wl.eventId._id.toString(), userId);
      return {
        ...wl,
        position: posData?.position ?? 1,
        queueLength: posData?.queueLength ?? 1,
      };
    }));

    return NextResponse.json({ 
      registrations, 
      waitlists: waitlistWithPositions 
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
