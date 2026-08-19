import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    const students = await User.aggregate([
      { $match: { role: 'student' } },
      {
        $lookup: {
          from: 'registrations',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$userId', '$$userId'] } } },
            { $group: { _id: null, totalRegistrations: { $sum: 1 }, totalAttended: { $sum: { $cond: [{ $eq: ['$checkedIn', true] }, 1, 0] } } } },
          ],
          as: 'regAgg',
        },
      },
      {
        $addFields: {
          totalRegistrations: { $ifNull: [{ $arrayElemAt: ['$regAgg.totalRegistrations', 0] }, 0] },
          totalAttended: { $ifNull: [{ $arrayElemAt: ['$regAgg.totalAttended', 0] }, 0] },
        },
      },
      { $project: { regAgg: 0, password: 0 } },
      { $sort: { reliabilityScore: -1, name: 1 } },
    ]);

    return NextResponse.json({ students });
  } catch (err) {
    console.error('[GET /api/admin/students]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
