import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { computeMetrics, computeScore, classifyTier, getTierBenefits } from '@/lib/ml/reliabilityScoring';
import { MODEL_PARAMS } from '@/lib/constants';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();

    const user = await User.findById(params.id)
      .select('name email engagementTier reliabilityScore createdAt college scoreHistory adminOverriddenTier')
      .lean();

    if (!user) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Compute fresh metrics with correct per-tier retention window
    const prevTier = (user as any).engagementTier ?? 'new';
    const retentionDays = MODEL_PARAMS.RETENTION_DAYS[prevTier] ?? 60;
    const metrics = await computeMetrics(params.id, retentionDays);

    // Admin overrides take priority — don't recompute
    if ((user as any).adminOverriddenTier) {
      const tier = (user as any).engagementTier ?? 'new';
      const benefits = getTierBenefits(tier);
      return NextResponse.json({
        student: {
          name: (user as any).name,
          email: (user as any).email,
          college: (user as any).college,
          accountAgeDays: Math.floor(
            (Date.now() - new Date((user as any).createdAt).getTime()) / 86_400_000
          ),
        },
        tier,
        score: (user as any).reliabilityScore,
        scoreHistory: (user as any).scoreHistory?.slice(0, 10) ?? [],
        metrics: {
          totalRegistrations: metrics.totalRegistrations,
          totalAttended: metrics.totalAttended,
          attendanceRate: Math.round(metrics.attendanceRate * 100),
          waitlistAbandonRate: Math.round(metrics.waitlistAbandonRate * 100),
          bulkRegistrationScore: metrics.bulkRegistrationScore,
        },
        benefits,
      });
    }

    // Recompute fresh score and tier from metrics (same logic as user route)
    let anomalyScore = 0;
    const recentHistory = (user as any).scoreHistory;
    if (Array.isArray(recentHistory) && recentHistory.length > 0) {
      const latest = recentHistory[recentHistory.length - 1] as any;
      if (latest?.anomalyScore != null) {
        anomalyScore = latest.anomalyScore;
      }
    }

    const freshTier = classifyTier(metrics, anomalyScore);
    const freshScore = computeScore(metrics, anomalyScore);
    const benefits = getTierBenefits(freshTier);

    return NextResponse.json({
      student: {
        name: (user as any).name,
        email: (user as any).email,
        college: (user as any).college,
        accountAgeDays: Math.floor(
          (Date.now() - new Date((user as any).createdAt).getTime()) / 86_400_000
        ),
      },
      tier: freshTier,
      score: freshScore,
      scoreHistory: (user as any).scoreHistory?.slice(0, 10) ?? [],
      metrics: {
        totalRegistrations: metrics.totalRegistrations,
        totalAttended: metrics.totalAttended,
        attendanceRate: Math.round(metrics.attendanceRate * 100),
        waitlistAbandonRate: Math.round(metrics.waitlistAbandonRate * 100),
        bulkRegistrationScore: metrics.bulkRegistrationScore,
      },
      benefits,
    });
  } catch (err) {
    console.error('[GET /api/admin/students/[id]/reliability]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
