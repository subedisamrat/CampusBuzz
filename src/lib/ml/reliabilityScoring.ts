import mongoose from 'mongoose';
import User from '@/models/User';
import Registration from '@/models/Registration';
import Waitlist from '@/models/Waitlist';
import { IsolationForest } from './isolationForest';
import connectDB from '@/lib/mongodb';
import {
  MODEL_PARAMS,
  ISOLATION_FOREST_TREES,
  ISOLATION_FOREST_SAMPLE,
} from '@/lib/constants';
import { TIER_CONFIG, ML_THRESHOLDS, TIME_UNITS, WAITLIST_HOUR_DISCOUNT_MS } from '@/lib/constants';

export type EngagementTier = 'champion' | 'regular' | 'new' | 'unreliable';

export interface ReliabilityMetrics {
  attendanceRate: number;
  waitlistAbandonRate: number;
  bulkRegistrationScore: number;
  cancellationRate: number;
  recentAttendanceRate: number;
  confirmationResponseHours: number;
  waitlistConversionRate: number;
  totalRegistrations: number;
  totalAttended: number;
  pastEventCount: number;
}

export interface ReliabilityResult {
  tier: EngagementTier;
  score: number;
  anomalyScore: number;
  metrics: ReliabilityMetrics;
  confirmationWindowHours: number;
  waitlistMultiplier: number;
}

export async function computeMetrics(userId: string, retentionDays: number = 30): Promise<ReliabilityMetrics> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - retentionDays * TIME_UNITS.DAY_MS);

  const userIdObj = new mongoose.Types.ObjectId(userId);

  const [
    totalRegistrations,
    totalConfirmed,
    totalCheckedIn,
    activeUnconfirmed,
    totalWaitlistPromotions,
    abandonedWaitlists,
    explicitCancellations,
    last5Regs,
    acceptedPromotions,
    pastEventCount,
  ] = await Promise.all([
    Registration.countDocuments({ userId }),
    // A5: Exclude cancelled events from confirmed count
    Registration.aggregate([
      { $match: { userId: userIdObj, confirmed: true } },
      { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
      { $unwind: '$event' },
      { $match: { 'event.isCancelled': { $ne: true } } },
      { $count: 'total' },
    ]).then(r => r[0]?.total ?? 0),
    // A5: Exclude cancelled events from checked-in count
    Registration.aggregate([
      { $match: { userId: userIdObj, checkedIn: true } },
      { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
      { $unwind: '$event' },
      { $match: { 'event.isCancelled': { $ne: true } } },
      { $count: 'total' },
    ]).then(r => r[0]?.total ?? 0),
    Registration.countDocuments({
      userId,
      confirmed: false,
      createdAt: { $gte: cutoff },
    }),
    Registration.countDocuments({ userId, promotedFromWaitlist: true }),
    Waitlist.countDocuments({ userId, abandonedAt: { $ne: null } }),
    Registration.countDocuments({ userId, cancelledAt: { $ne: null } }),
    Registration.find({ userId, confirmed: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('checkedIn confirmedAt confirmationEmailSentAt')
      .lean(),
    Registration.countDocuments({ userId, promotedFromWaitlist: true, confirmed: true }),
    // Count registrations for past events
    Registration.aggregate([
      { $match: { userId: userIdObj } },
      { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
      { $unwind: '$event' },
      { $match: { 'event.date': { $lt: now }, 'event.isCancelled': { $ne: true } } },
      { $count: 'total' },
    ]).then(r => r[0]?.total ?? 0),
  ]);

  // A5: Fixed attendance rate — cancelled events excluded from denominator
  const attendanceRate = totalConfirmed > 0 ? Math.min(totalCheckedIn / totalConfirmed, 1) : 0;
  // A5: Fixed waitlistAbandonRate — guard against division by zero
  const waitlistAbandonRate = totalWaitlistPromotions > 0
    ? Math.min(abandonedWaitlists / totalWaitlistPromotions, 1)
    : 0;

  // Recent attendance rate (last 5 confirmed registrations)
  const recentAttendanceRate = last5Regs.length > 0
    ? last5Regs.filter((r: any) => r.checkedIn).length / last5Regs.length
    : attendanceRate;

  // Average confirmation response time (hours from email sent to confirmed)
  const responseTimes = last5Regs
    .filter((r: any) => r.confirmedAt && r.confirmationEmailSentAt)
    .map((r: any) =>
      (new Date(r.confirmedAt).getTime() - new Date(r.confirmationEmailSentAt).getTime()) / WAITLIST_HOUR_DISCOUNT_MS
    );
  const avgResponseHours = responseTimes.length > 0
    ? responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
    : 12;

  // A1: Count attended events (total checked-in to non-cancelled events)
  const totalAttended = totalCheckedIn;

  return {
    attendanceRate:            Math.min(Math.round(attendanceRate * 100) / 100, 1),
    waitlistAbandonRate:       Math.min(Math.round(waitlistAbandonRate * 100) / 100, 1),
    bulkRegistrationScore:     Math.min(activeUnconfirmed, 10),
    cancellationRate:          totalRegistrations > 0 ? explicitCancellations / totalRegistrations : 0,
    recentAttendanceRate:      Math.min(Math.round(recentAttendanceRate * 100) / 100, 1),
    confirmationResponseHours: Math.min(avgResponseHours, 48),
    waitlistConversionRate:    totalWaitlistPromotions > 0 ? acceptedPromotions / totalWaitlistPromotions : 1,
    totalRegistrations,
    totalAttended,
    pastEventCount,
  };
}

let reliabilityModel: IsolationForest | null = null;
let reliabilityModelTrained = false;
let reliabilityTrainingCount = 0;

export async function trainReliabilityModel(): Promise<void> {
  await connectDB();

  const users = await User.find({ role: 'student' }, '_id').lean() as { _id: import('mongoose').Types.ObjectId }[];

  const minStudents = ML_THRESHOLDS.reliability.minStudentsToTrain;
  if (users.length < minStudents) {
    console.log(`[ReliabilityIF] Not enough students to train — need ${minStudents}+, have ${users.length}`);
    return;
  }

  const featureVectors: number[][] = [];

  for (const user of users) {
    try {
      const metrics = await computeMetrics(user._id.toString());
      if (metrics.totalRegistrations < ML_THRESHOLDS.reliability.minRegistrationsToScore) continue;

      const vector = [
        metrics.attendanceRate,
        metrics.waitlistAbandonRate,
        Math.min(metrics.bulkRegistrationScore / 10, 1),
        metrics.cancellationRate,
        metrics.recentAttendanceRate,
        Math.min(metrics.confirmationResponseHours / 48, 1),
        1 - metrics.waitlistConversionRate,
      ];

      // A8: Skip if any feature is invalid (NaN or Infinity)
      if (vector.some(v => isNaN(v) || !isFinite(v))) continue;

      featureVectors.push(vector);
    } catch (err) {
      console.warn(`[ReliabilityIF] Skipping user ${user._id}:`, err);
    }
  }

  if (featureVectors.length < minStudents) {
    console.log(`[ReliabilityIF] Not enough data points to train — need ${minStudents}+, have ${featureVectors.length}`);
    return;
  }

  reliabilityModel = new IsolationForest(ISOLATION_FOREST_TREES, ISOLATION_FOREST_SAMPLE);
  reliabilityModel.train(featureVectors);
  reliabilityModelTrained = true;
  reliabilityTrainingCount = featureVectors.length;

  console.log('[ReliabilityIF] Trained on', featureVectors.length, 'students');
}

export async function ensureReliabilityTraining(): Promise<void> {
  if (!isReliabilityModelReady()) {
    try {
      await trainReliabilityModel();
    } catch (err) {
      console.error('[ReliabilityIF] ensureReliabilityTraining failed:', err);
    }
  }
}

export function isReliabilityModelReady(): boolean {
  return reliabilityModelTrained && reliabilityModel !== null;
}

export function getReliabilityModelStats() {
  return {
    trained: reliabilityModelTrained,
    trainingCount: reliabilityTrainingCount,
  };
}

function classifyTier(
  metrics: ReliabilityMetrics,
  anomalyScore: number
): EngagementTier {
  const { attendanceRate, waitlistAbandonRate, bulkRegistrationScore,
          totalRegistrations, totalAttended, recentAttendanceRate,
          cancellationRate, pastEventCount } = metrics;

  // Not enough data to classify — always New
  if (totalRegistrations < ML_THRESHOLDS.reliability.minRegistrationsToScore) {
    return 'new';
  }

  // Guard: if student has attended 0 events AND has no past events,
  // skip attendance/cancellation unreliable checks — all registrations are future
  const hasPastEvents = pastEventCount > 0;

  // Unreliable: triggered by ANY one of these conditions
  const isUnreliable =
    (hasPastEvents || totalAttended > 0) && (
      attendanceRate < ML_THRESHOLDS.reliability.unreliableMaxAttendance ||
      cancellationRate >= ML_THRESHOLDS.reliability.maxCancellationRate
    ) ||
    waitlistAbandonRate >= TIER_CONFIG.regular.maxWaitlistAbandon ||
    bulkRegistrationScore >= ML_THRESHOLDS.reliability.unreliableMaxBulkRegistrations ||
    anomalyScore >= ML_THRESHOLDS.reliability.unreliableAnomalyScore;

  if (isUnreliable) return 'unreliable';

  // Champion: ALL conditions must be true
  const championConfig = TIER_CONFIG.champion;
  const isChampion =
    totalAttended >= championConfig.minAttended &&
    attendanceRate >= championConfig.minAttendanceRate &&
    recentAttendanceRate >= championConfig.minRecentRate &&
    waitlistAbandonRate < championConfig.maxWaitlistAbandon &&
    anomalyScore < ML_THRESHOLDS.checkin.flagThreshold;

  if (isChampion) return 'champion';

  // Regular: base conditions
  const regularConfig = TIER_CONFIG.regular;
  const isRegular =
    totalAttended >= regularConfig.minAttended &&
    attendanceRate >= regularConfig.minAttendanceRate &&
    waitlistAbandonRate < regularConfig.maxWaitlistAbandon;

  if (isRegular) return 'regular';

  // Default: new (not enough history to classify as regular)
  return 'new';
}

function computeScore(metrics: ReliabilityMetrics, anomalyScore: number): number {
  if (metrics.totalRegistrations < ML_THRESHOLDS.reliability.minRegistrationsToScore) return 0;

  const attendanceComponent = metrics.attendanceRate * 60;
  const waitlistComponent = (1 - metrics.waitlistAbandonRate) * 25;
  const mlComponent = (1 - anomalyScore) * 15;

  return Math.round(Math.min(attendanceComponent + waitlistComponent + mlComponent, 100));
}

export function getTierBenefits(tier: EngagementTier): {
  confirmationWindowHours: number;
  waitlistMultiplier: number;
  waitlistPenaltyHours: number;
} {
  const config = TIER_CONFIG[tier];
  return {
    confirmationWindowHours: config.confirmationWindowHours,
    waitlistMultiplier: config.waitlistMultiplier,
    waitlistPenaltyHours: config.waitlistPenaltyHours,
  };
}

export async function updateStudentReliability(userId: string): Promise<ReliabilityResult | null> {
  const prevUser = await User.findById(userId).select('reliabilityScore engagementTier adminOverriddenTier').lean();
  const prevData = prevUser as any;

  const prevTier = prevData?.engagementTier ?? 'new';
  const retentionDays = MODEL_PARAMS.RETENTION_DAYS[prevTier] ?? 30;
  const metrics = await computeMetrics(userId, retentionDays);

  // Guard: if no registrations found, don't recalculate (prevents spurious score drops)
  if (metrics.totalRegistrations === 0) {
    console.warn(`[Reliability] Skipping update for ${userId} — 0 registrations found`);
    const benefits = getTierBenefits(prevTier);
    return {
      tier: prevTier,
      score: prevData?.reliabilityScore ?? 0,
      anomalyScore: 0,
      metrics,
      confirmationWindowHours: benefits.confirmationWindowHours,
      waitlistMultiplier: benefits.waitlistMultiplier,
    };
  }

  const TIER_ORDER: EngagementTier[] = ['new', 'unreliable', 'regular', 'champion'];
  const wasAdminOverridden = prevData?.adminOverriddenTier ?? false;

  let anomalyScore = 0;

  // Inline training if model not ready yet (startup training may still be running)
  if (!isReliabilityModelReady()) {
    try {
      await trainReliabilityModel();
    } catch (err) {
      console.error('[ReliabilityIF] Inline training failed:', err);
    }
  }

  if (isReliabilityModelReady() && metrics.totalRegistrations >= ML_THRESHOLDS.reliability.minRegistrationsToScore) {
    try {
      anomalyScore = reliabilityModel!.anomalyScore([
        metrics.attendanceRate,
        metrics.waitlistAbandonRate,
        Math.min(metrics.bulkRegistrationScore / 10, 1),
        metrics.cancellationRate,
        metrics.recentAttendanceRate,
        Math.min(metrics.confirmationResponseHours / 48, 1),
        1 - metrics.waitlistConversionRate,
      ]);
    } catch (err) {
      console.error('[ReliabilityIF] Scoring failed:', err);
      anomalyScore = 0;
    }
  }

  const tier = classifyTier(metrics, anomalyScore);
  const score = computeScore(metrics, anomalyScore);
  const benefits = getTierBenefits(tier);

  // Re-check if admin overrode during our computation (race condition guard)
  // Only block if new tier would DOWNGRADE the student; allow upgrades
  const freshUser = await User.findById(userId).select('adminOverriddenTier engagementTier reliabilityScore').lean();
  const freshData = freshUser as any;
  if (freshData?.adminOverriddenTier) {
    const existingTier = freshData.engagementTier ?? 'new';
    const existingIdx = TIER_ORDER.indexOf(existingTier);
    const newIdx = TIER_ORDER.indexOf(tier);
    if (newIdx >= existingIdx) {
      // Upgrade or same tier — allow it and clear override
      // (falls through to the write below)
    } else {
      // Downgrade — keep admin's values
      const existingScore = freshData.reliabilityScore ?? 0;
      const existingBenefits = getTierBenefits(existingTier);
      return {
        tier: existingTier,
        score: existingScore,
        anomalyScore: 0,
        metrics,
        confirmationWindowHours: existingBenefits.confirmationWindowHours,
        waitlistMultiplier: existingBenefits.waitlistMultiplier,
      };
    }
  }

  const prevScore = (prevUser as any)?.reliabilityScore ?? 0;
  const scoreDiff = Math.abs((score ?? 0) - prevScore);

  const historyEntry = {
    score: score ?? 0,
    tier,
    reason: buildScoreChangeReason(tier, metrics, anomalyScore),
    changedAt: new Date(),
  };

  const updateData: Record<string, any> = {
    engagementTier: tier,
    reliabilityScore: metrics.totalRegistrations >= ML_THRESHOLDS.reliability.minRegistrationsToScore ? score : null,
    $push: {
      scoreHistory: {
        $each: [historyEntry],
        $position: 0,
        $slice: 20,
      },
    },
  };

  // If admin overrode but student upgraded, clear the override flag
  if (wasAdminOverridden) {
    updateData.adminOverriddenTier = false;
    updateData.adminOverriddenAt = null;
  }

  await User.findByIdAndUpdate(userId, updateData)
    .catch(err => console.error('[Reliability] Failed to save tier:', err));

  return {
    tier,
    score,
    anomalyScore: Math.round(anomalyScore * 1000) / 1000,
    metrics,
    confirmationWindowHours: benefits.confirmationWindowHours,
    waitlistMultiplier: benefits.waitlistMultiplier,
  };
}

let updatesSinceRetrain = 0;

function buildScoreChangeReason(
  tier: string,
  metrics: ReliabilityMetrics,
  anomalyScore: number
): string {
  const champRate = Math.round(TIER_CONFIG.champion.minAttendanceRate * 100);
  const regRate = Math.round(TIER_CONFIG.regular.minAttendanceRate * 100);
  const attendedPct = Math.round(metrics.attendanceRate * 100);
  const hasPastEvents = metrics.pastEventCount > 0;

  // Guard: no past events yet — all registrations are future
  if (!hasPastEvents && metrics.totalAttended === 0 && metrics.totalRegistrations >= ML_THRESHOLDS.reliability.minRegistrationsToScore) {
    return `${metrics.totalRegistrations} registrations (all future events) — score pending attendance data`;
  }

  // Unreliable reasons (highest priority — check these first)
  if (hasPastEvents && metrics.attendanceRate < ML_THRESHOLDS.reliability.unreliableMaxAttendance) {
    return `Attendance ${attendedPct}% (below ${Math.round(ML_THRESHOLDS.reliability.unreliableMaxAttendance * 100)}%) — classified as Unreliable`;
  }
  if (metrics.waitlistAbandonRate >= TIER_CONFIG.regular.maxWaitlistAbandon) {
    return `Waitlist abandon ${Math.round(metrics.waitlistAbandonRate * 100)}% — flagged as Unreliable`;
  }
  if (metrics.bulkRegistrationScore >= ML_THRESHOLDS.reliability.unreliableMaxBulkRegistrations) {
    return `${metrics.bulkRegistrationScore} unconfirmed registrations — bulk registration pattern detected`;
  }
  if (hasPastEvents && metrics.cancellationRate >= ML_THRESHOLDS.reliability.maxCancellationRate) {
    return `Cancellation rate ${Math.round(metrics.cancellationRate * 100)}% — exceeds Unreliable threshold`;
  }
  if (anomalyScore >= ML_THRESHOLDS.reliability.unreliableAnomalyScore) {
    return `Isolation Forest anomaly score ${anomalyScore.toFixed(2)} — behavior pattern flagged`;
  }

  // Champion
  if (metrics.totalAttended >= TIER_CONFIG.champion.minAttended &&
      metrics.attendanceRate >= TIER_CONFIG.champion.minAttendanceRate &&
      metrics.recentAttendanceRate >= TIER_CONFIG.champion.minRecentRate) {
    return `${attendedPct}% attendance (${metrics.totalAttended}/${metrics.totalRegistrations}), ${Math.round(metrics.recentAttendanceRate * 100)}% recent rate → Champion`;
  }

  // Regular
  if (metrics.totalAttended >= TIER_CONFIG.regular.minAttended &&
      metrics.attendanceRate >= TIER_CONFIG.regular.minAttendanceRate) {
    return `${attendedPct}% attendance, ${metrics.totalAttended} events attended → Regular tier`;
  }

  // New / fallback
  if (metrics.totalRegistrations < ML_THRESHOLDS.reliability.minRegistrationsToScore) {
    return `${metrics.totalRegistrations} registrations — needs 3+ to calculate score (New tier)`;
  }

  return `Reliability recalculated — ${attendedPct}% attendance, ${metrics.totalAttended}/${metrics.totalRegistrations} events → ${tier}`;
}

export function maybeRetrain(): void {
  updatesSinceRetrain++;
  if (updatesSinceRetrain >= ML_THRESHOLDS.reliability.retrainAfter) {
    updatesSinceRetrain = 0;
    void trainReliabilityModel().catch(err =>
      console.error('[ReliabilityIF] Retrain failed:', err)
    );
  }
}
