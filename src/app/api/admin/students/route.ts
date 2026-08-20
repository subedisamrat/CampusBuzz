import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { computeMetrics, computeScore, classifyTier } from '@/lib/ml/reliabilityScoring';
import { MODEL_PARAMS } from '@/lib/constants';

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

    // Compute fresh scores for all students in parallel
    const studentsWithScores = await Promise.all(
      students.map(async (s: any) => {
        try {
          // Admin overrides take priority — don't recompute
          if (s.adminOverriddenTier) return s;

          const userId = s._id.toString();
          const prevTier = s.engagementTier ?? 'new';
          const retentionDays = MODEL_PARAMS.RETENTION_DAYS[prevTier] ?? 60;
          const metrics = await computeMetrics(userId, retentionDays);

          let anomalyScore = 0;
          const recentHistory = s.scoreHistory;
          if (Array.isArray(recentHistory) && recentHistory.length > 0) {
            const latest = recentHistory[recentHistory.length - 1];
            if (latest?.anomalyScore != null) anomalyScore = latest.anomalyScore;
          }

          const freshTier = classifyTier(metrics, anomalyScore);
          const freshScore = computeScore(metrics, anomalyScore);

          return {
            ...s,
            engagementTier: freshTier,
            reliabilityScore: freshScore,
          };
        } catch {
          return s;
        }
      })
    );

    // Sort by fresh score (nulls last), then name
    studentsWithScores.sort((a: any, b: any) => {
      const scoreA = a.reliabilityScore ?? -1;
      const scoreB = b.reliabilityScore ?? -1;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ students: studentsWithScores });
  } catch (err) {
    console.error('[GET /api/admin/students]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
