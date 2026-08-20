import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();

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
    ]);

    // Use stored tier/score from DB (kept current by updateStudentReliability)
    // Don't recompute — DB is the source of truth
    const sorted = students.sort((a: any, b: any) => {
      const scoreA = a.reliabilityScore ?? -1;
      const scoreB = b.reliabilityScore ?? -1;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ students: sorted });
  } catch (err) {
    console.error('[GET /api/admin/students]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
