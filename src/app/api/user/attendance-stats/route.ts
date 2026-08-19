import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Registration from '@/models/Registration';
import mongoose from 'mongoose';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    await connectDB();
    // Cast to ObjectId so Mongoose matches correctly against the stored ObjectId field
    const userId = new mongoose.Types.ObjectId(session.user.id);

    const [totalRegistered, totalAttended, totalConfirmed] = await Promise.all([
      Registration.countDocuments({ userId }),
      Registration.countDocuments({ userId, checkedIn: true }),
      Registration.countDocuments({ userId, confirmed: true }),
    ]);

    const attendanceRate = totalRegistered > 0
      ? Math.round((totalAttended / totalRegistered) * 100)
      : 0;

    const trustLevel: 'high' | 'building' =
      totalAttended >= 3 && attendanceRate >= 60 ? 'high' : 'building';

    return NextResponse.json({
      totalRegistered,
      totalAttended,
      totalConfirmed,
      attendanceRate,
      trustLevel,
      priorityBonus: totalAttended,
    });
  } catch (err) {
    console.error('[GET /api/user/attendance-stats]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
