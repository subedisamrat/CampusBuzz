import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Event from '@/models/Event';
import Registration from '@/models/Registration';
import User from '@/models/User';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 401 });
    }

    await dbConnect();

    const now = new Date();
    const [
      totalEvents,
      upcomingEvents,
      totalUsers,
      totalRegistrations,
      checkedInCount,
      allEvents,
    ] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ date: { $gt: now }, isActive: true, isCancelled: { $ne: true } }),
      User.countDocuments({ role: 'student' }),
      Registration.countDocuments(),
      Registration.countDocuments({ checkedIn: true }),
      // Show ALL events to admin (including inactive/cancelled) so they can manage everything
      Event.find({}).sort({ date: -1 }).lean(),
    ]);

    return NextResponse.json({
      totalEvents,
      upcomingEvents,
      totalUsers,
      totalRegistrations,
      checkedInCount,
      recentEvents: allEvents,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
