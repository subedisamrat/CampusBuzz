import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Registration from '@/models/Registration';
import Waitlist from '@/models/Waitlist';
import User from '@/models/User';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalRegistrations,
      uniqueUsersArr,
      waitlistTotal,
      waitlistEventsArr,
      flaggedToday,
      blockedToday,
      totalCheckins,
      tierDistribution,
      reliabilityAvg,
      eligibleReliabilityStudents,
    ] = await Promise.all([
      Registration.countDocuments({}),
      Registration.distinct('userId'),
      Waitlist.countDocuments({}),
      Waitlist.distinct('eventId'),
      Registration.countDocuments({ flagged: true, checkedInAt: { $gte: todayStart } }),
      Registration.countDocuments({
        flagged: true,
        checkedIn: false,
        anomalyScore: { $gte: 0.8 },
        updatedAt: { $gte: todayStart },
      }),
      Registration.countDocuments({ checkedIn: true }),
      User.aggregate([
        { $match: { role: 'student', engagementTier: { $ne: null } } },
        { $group: { _id: '$engagementTier', count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: { role: 'student', reliabilityScore: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$reliabilityScore' } } },
      ]),
      // Count students with 3+ registrations (eligible for reliability scoring)
      Registration.aggregate([
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $match: { count: { $gte: 3 } } },
        { $count: 'total' },
      ]).then(r => r[0]?.total ?? 0),
    ]);

    const tierMap: Record<string, number> = { champion: 0, regular: 0, new: 0, unreliable: 0 };
    for (const t of tierDistribution) {
      tierMap[t._id] = t.count;
    }

    // Ensure models are trained before reading stats
    const { ensureCheckinModel, getModelStats } = await import('@/lib/ml/modelManager');
    await ensureCheckinModel().catch(err => console.error(err));
    const mlStats = getModelStats();

    const { ensureReliabilityTraining, getReliabilityModelStats } = await import('@/lib/ml/reliabilityScoring');
    await ensureReliabilityTraining().catch(err => console.error(err));
    const relStats = getReliabilityModelStats();

    // Get cache stats
    const { recommendationCache } = await import('@/lib/recommendations/recommendationCache');
    const cacheStats = recommendationCache.stats();

    return NextResponse.json({
      collaborativeFiltering: {
        usersInMatrix: uniqueUsersArr.length,
        totalRegistrations,
        cacheSize: cacheStats.size,
        status: uniqueUsersArr.length >= 2 ? 'active' : 'warming_up',
      },
      waitlist: {
        studentsWaiting: waitlistTotal,
        eventsWithWaitlist: waitlistEventsArr.length,
        status: 'active',
      },
      isolationForest: {
        trainedOnSamples: mlStats.trainingCount ?? 0,
        flaggedToday,
        blockedToday,
        totalCheckins,
        status: mlStats.trained ? 'active' : 'warming_up',
        minSamplesNeeded: 20,
      },
      reliability: {
        trained: relStats.trained,
        trainingCount: relStats.trainingCount,
        totalStudents: await User.countDocuments({ role: 'student' }),
        tierDistribution: tierMap,
        averageScore: reliabilityAvg.length > 0 ? Math.round(reliabilityAvg[0].avg) : null,
        status: relStats.trained ? 'active' : 'warming_up',
        minStudentsNeeded: 10,
        eligibleStudents: eligibleReliabilityStudents,
      },
    });
  } catch (err) {
    console.error('[GET /api/admin/algorithm-stats]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
