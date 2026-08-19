import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import Event from '@/models/Event';
import Registration from '@/models/Registration';
import Waitlist from '@/models/Waitlist';
import User from '@/models/User';
import { getWaitlistPosition, getSortedWaitlist } from '@/lib/algorithms/waitlistManager';
import { updateStudentReliability, maybeRetrain } from '@/lib/ml/reliabilityScoring';
import { logActivity } from '@/lib/activityLog';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Login required' }, { status: 401 });
    if (session.user.role === 'admin') {
      return NextResponse.json({ error: 'Admins cannot join waitlists' }, { status: 403 });
    }

    await connectDB();
    const { eventId } = await req.json();
    const userId = session.user.id;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    const event = await Event.findById(eventId).lean() as any;
    if (!event || !event.isActive || event.isCancelled) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.registeredCount < event.capacity) {
      return NextResponse.json({
        error: 'Event still has spots — register directly',
      }, { status: 400 });
    }

    const existingReg = await Registration.findOne({ userId, eventId }).lean();
    if (existingReg) {
      return NextResponse.json({ error: 'Already registered for this event' }, { status: 409 });
    }

    const existingWaitlist = await Waitlist.findOne({
      userId, eventId, abandonedAt: null,
    }).lean();
    if (existingWaitlist) {
      return NextResponse.json({ error: 'Already on waitlist' }, { status: 409 });
    }

    const previousPromotion = await Waitlist.findOne({
      userId, eventId, wasPromoted: true,
    }).lean();
    const wasPromotedBefore = !!previousPromotion;

    await Waitlist.create({
      eventId,
      userId,
      joinedAt: new Date(),
      wasPromoted: false,
      abandonedAt: null,
    });

    const positionData = await getWaitlistPosition(eventId, userId);

    // Log activity
    void (async () => {
      try {
        const ev = await Event.findById(eventId).select('title').lean() as any;
        void logActivity({
          userId,
          action: 'waitlist_join',
          eventId,
          eventTitle: ev?.title ?? '',
          details: `Joined waitlist for ${ev?.title ?? 'event'}`,
          algorithmTriggers: positionData ? [`Position #${positionData.position} of ${positionData.queueLength}`] : undefined,
        });
      } catch {}
    })();

    return NextResponse.json({
      success: true,
      position: positionData?.position ?? 1,
      queueLength: positionData?.queueLength ?? 1,
      wasPromotedBefore,
    });
  } catch (err) {
    console.error('[POST /api/waitlist]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 });

    const userId = session.user.id;
    const positionData = await getWaitlistPosition(eventId, userId);

    if (!positionData) {
      return NextResponse.json({ onWaitlist: false });
    }

    const user = await User.findById(userId).select('engagementTier').lean() as any;
    const tier = user?.engagementTier ?? 'new';

    const sorted = await getSortedWaitlist(eventId);
    const myIndex = sorted.findIndex(e => e.userId === userId);
    const aheadUsers = sorted.slice(0, myIndex);

    const aheadUserTiers = aheadUsers.length > 0
      ? (await User.find({ _id: { $in: aheadUsers.map(e => e.userId) } })
          .select('engagementTier')
          .lean() as any[]).map((u: any) => u?.engagementTier ?? 'new')
      : [];

    const championsAhead = aheadUserTiers.filter(t => t === 'champion').length;

    return NextResponse.json({
      onWaitlist: true,
      position: positionData.position,
      queueLength: positionData.queueLength,
      tier,
      championsAhead,
      priorityNote: tier === 'champion'
        ? 'Your Champion status gives you 2× priority bonus'
        : tier === 'unreliable'
          ? 'Your attendance history affects your priority. Attend events to improve.'
          : 'Attend more events to improve your waitlist priority',
    });
  } catch (err) {
    console.error('[GET /api/waitlist]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    await connectDB();
    const { eventId } = await req.json();
    const userId = session.user.id;

    const entry = await Waitlist.findOne({ userId, eventId, abandonedAt: null }).lean();
    if (!entry) return NextResponse.json({ error: 'Not on waitlist' }, { status: 404 });

    const wasPromoted = await Registration.findOne({ userId, eventId, promotedFromWaitlist: true }).lean();

    if (wasPromoted) {
      await Waitlist.updateOne({ userId, eventId }, { $set: { abandonedAt: new Date() } });
    } else {
      await Waitlist.deleteOne({ userId, eventId });
    }

    void updateStudentReliability(userId).catch(err =>
      console.error('[Reliability] Update after waitlist leave failed:', err)
    );
    maybeRetrain();

    // Log activity
    void (async () => {
      try {
        const ev = await Event.findById(eventId).select('title').lean() as any;
        void logActivity({
          userId,
          action: 'waitlist_leave',
          eventId,
          eventTitle: ev?.title ?? '',
          details: `Left waitlist for ${ev?.title ?? 'event'}`,
        });
      } catch {}
    })();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/waitlist]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
