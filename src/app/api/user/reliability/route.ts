/**
 * GET /api/user/reliability
 *
 * Returns the student's reliability score, tier, metrics, and improvement tips.
 * Uses stored tier/score from the User document (kept current by updateStudentReliability).
 * Metrics (attendance rate, etc.) are computed fresh for display.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import {
  computeMetrics, getTierBenefits, isReliabilityModelReady,
} from '@/lib/ml/reliabilityScoring';
import { MODEL_PARAMS } from '@/lib/constants';
import { TIER_CONFIG, TIER_IMPROVEMENT_TEXT } from '@/lib/constants';

interface ReliabilityMetrics {
  totalRegistrations: number;
  attendanceRate: number;
  waitlistAbandonRate: number;
  bulkRegistrationScore: number;
  totalAttended: number;
}

function computeImprovementTip(tier: string, metrics: ReliabilityMetrics): string {
  const champConf = TIER_CONFIG.champion;

  if (tier === 'champion') {
    return TIER_IMPROVEMENT_TEXT.maintainChamp
      .replace('{rate}', String(Math.round(champConf.minAttendanceRate * 100)));
  }

  if (tier === 'regular') {
    const needed = champConf.minAttended - metrics.totalAttended;
    if (needed > 0) {
      return TIER_IMPROVEMENT_TEXT.toChampion
        .replace('{needed}', String(needed))
        .replace('{s}', needed !== 1 ? 's' : '')
        .replace('{rate}', String(Math.round(champConf.minAttendanceRate * 100)));
    }
    return TIER_IMPROVEMENT_TEXT.maintainChamp
      .replace('{rate}', String(Math.round(champConf.minAttendanceRate * 100)));
  }

  if (tier === 'new') {
    return TIER_IMPROVEMENT_TEXT.newStudent
      .replace('{attended}', String(metrics.totalAttended))
      .replace('{needed}', String(TIER_CONFIG.regular.minAttended));
  }

  if (tier === 'unreliable') {
    if (metrics.attendanceRate < 0.25) {
      return TIER_IMPROVEMENT_TEXT.unreliableRate
        .replace('{rate}', String(Math.round(metrics.attendanceRate * 100)));
    }
    if (metrics.waitlistAbandonRate >= 0.5) {
      return TIER_IMPROVEMENT_TEXT.unreliableAbandon;
    }
    return TIER_IMPROVEMENT_TEXT.unreliableBulk;
  }

  return '';
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    await dbConnect();
    const userId = session.user.id;

    const user = await User.findById(userId)
      .select('engagementTier reliabilityScore createdAt scoreHistory')
      .lean();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Use stored tier/score from DB (kept current by updateStudentReliability)
    const tier = (user as any).engagementTier ?? 'new';
    const score = (user as any).reliabilityScore ?? 0;
    const benefits = getTierBenefits(tier);

    // Compute fresh metrics for display only
    const retentionDays = MODEL_PARAMS.RETENTION_DAYS[tier] ?? 60;
    const metrics = await computeMetrics(userId, retentionDays);

    const totalAttended = metrics.totalAttended;
    const metricsWithAttended: ReliabilityMetrics = {
      totalRegistrations: metrics.totalRegistrations,
      attendanceRate: metrics.attendanceRate,
      waitlistAbandonRate: metrics.waitlistAbandonRate,
      bulkRegistrationScore: metrics.bulkRegistrationScore,
      totalAttended,
    };
    const improvementTip = computeImprovementTip(tier, metricsWithAttended);

    return NextResponse.json({
      tier,
      score,
      scoreHistory: (user as any).scoreHistory?.slice(0, 10) ?? [],
      metrics: {
        totalRegistered: metrics.totalRegistrations,
        totalAttended,
        attendanceRate: Math.round(metrics.attendanceRate * 100),
        waitlistAbandonRate: Math.round(metrics.waitlistAbandonRate * 100),
        bulkRegistrationScore: metrics.bulkRegistrationScore,
      },
      benefits: {
        confirmationWindowHours: benefits.confirmationWindowHours,
        waitlistMultiplier: benefits.waitlistMultiplier,
        waitlistPenaltyHours: benefits.waitlistPenaltyHours,
      },
      modelActive: isReliabilityModelReady(),
      improvementTip,
    });
  } catch (err) {
    console.error('[GET /api/user/reliability]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
