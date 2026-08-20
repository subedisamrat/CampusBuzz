/**
 * Reliability Scoring System
 *
 * Computes a 0–100 reliability score and engagement tier (champion/regular/new/unreliable)
 * for each student based on their event attendance behavior.
 *
 * Score formula (weights sum to 100):
 *   attendanceRate × 40          — core signal: did they show up?
 *   recentAttendanceRate × 15    — trend: are they improving or declining?
 *   (1 − cancellationRate) × 10 — commitment: do they follow through?
 *   (1 − confirmationNorm) × 5  — responsiveness: how fast do they confirm?
 *   waitlistBehavior × 10        — reliability: do they honor waitlist commitments?
 *   (1 − anomalyScore) × 15     — ML signal: is their behavior normal?
 *   (1 − bulkRegNorm) × 5       — anti-gaming: are they mass-registering?
 *
 * Tiers determine student benefits:
 *   champion  — 48h confirm window, 2× waitlist priority
 *   regular   — 24h confirm window, 1× waitlist priority
 *   new       — 24h confirm window, no waitlist priority
 *   unreliable — 12h confirm window, waitlist penalty
 */

import mongoose from 'mongoose';
import User from '@/models/User';
import Registration from '@/models/Registration';
import Waitlist from '@/models/Waitlist';
import { IsolationForest } from './isolationForest';
import dbConnect from '@/lib/mongodb';
import {
  MODEL_PARAMS,
  ISOLATION_FOREST_TREES,
  ISOLATION_FOREST_SAMPLE,
} from '@/lib/constants';
import { TIER_CONFIG, ML_THRESHOLDS, TIME_UNITS } from '@/lib/constants';

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

/**
 * Builds the 7-dimensional feature vector for the reliability Isolation Forest.
 * Extracted here to avoid duplication between training and scoring.
 */
function buildFeatureVector(metrics: ReliabilityMetrics): number[] {
  return [
    metrics.attendanceRate,
    metrics.waitlistAbandonRate,
    Math.min(metrics.bulkRegistrationScore / 10, 1),
    metrics.cancellationRate,
    metrics.recentAttendanceRate,
    Math.min(metrics.confirmationResponseHours / 48, 1),
    1 - metrics.waitlistConversionRate,
  ];
}

/**
 * Computes all reliability metrics for a student from raw DB data.
 * All DB queries run in parallel for performance.
 *
 * @param userId - Student user ID
 * @param retentionDays - How far back to look for bulk registration detection (default 60)
 */
export async function computeMetrics(userId: string, retentionDays: number = 60): Promise<ReliabilityMetrics> {
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
    last5PastRegs,
    acceptedPromotions,
    pastEventCount,
  ] = await Promise.all([
    Registration.countDocuments({ userId }),
    // Confirmed count — exclude cancelled events
    Registration.aggregate([
      { $match: { userId: userIdObj, confirmed: true } },
      { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
      { $unwind: '$event' },
      { $match: { 'event.isCancelled': { $ne: true } } },
      { $count: 'total' },
    ]).then(r => r[0]?.total ?? 0),
    // Checked-in count — exclude cancelled events
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
    // True abandonments: left waitlist without being promoted
    // (promoted records have promotedAt set; abandoned records have abandonedAt set but no promotedAt)
    Waitlist.countDocuments({
      userId,
      abandonedAt: { $ne: null },
      $or: [
        { wasPromoted: { $ne: true } },
        { promotedAt: null },
      ],
    }),
    Registration.countDocuments({ userId, cancelledAt: { $ne: null } }),
    // Last 5 confirmed registrations for PAST events only (for recent attendance + response time)
    Registration.aggregate([
      { $match: { userId: userIdObj, confirmed: true } },
      { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
      { $unwind: '$event' },
      { $match: { 'event.date': { $lt: now }, 'event.isCancelled': { $ne: true } } },
      { $sort: { 'event.date': -1 } },
      { $limit: 5 },
      { $project: { checkedIn: 1, confirmedAt: 1, confirmationEmailSentAt: 1 } },
    ]),
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

  // Core attendance rate — cancelled events excluded from denominator
  const attendanceRate = totalConfirmed > 0 ? Math.min(totalCheckedIn / totalConfirmed, 1) : 0;

  // Waitlist abandon rate — only count TRUE abandonments (not promotions)
  const waitlistAbandonRate = totalWaitlistPromotions > 0
    ? Math.min(abandonedWaitlists / totalWaitlistPromotions, 1)
    : 0;

  // Recent attendance rate — last 5 PAST events only (excludes future events)
  const recentAttendanceRate = last5PastRegs.length > 0
    ? last5PastRegs.filter((r: any) => r.checkedIn).length / last5PastRegs.length
    : attendanceRate;

  // Average confirmation response time (hours from email sent to confirmed)
  const responseTimes = last5PastRegs
    .filter((r: any) => r.confirmedAt && r.confirmationEmailSentAt)
    .map((r: any) =>
      (new Date(r.confirmedAt).getTime() - new Date(r.confirmationEmailSentAt).getTime()) / TIME_UNITS.HOUR_MS
    );
  const avgResponseHours = responseTimes.length > 0
    ? responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
    : 12;

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

// ─── Reliability Isolation Forest ─────────────────────────────────────────────

let reliabilityModel: IsolationForest | null = null;
let reliabilityModelTrained = false;
let reliabilityTrainingCount = 0;
let reliabilityTrainingPromise: Promise<void> | null = null;

/**
 * Trains the reliability Isolation Forest on all student feature vectors.
 * Non-blocking: caches the promise to prevent duplicate training runs.
 */
export async function trainReliabilityModel(): Promise<void> {
  await dbConnect();

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

      const vector = buildFeatureVector(metrics);

      // Skip if any feature is invalid (NaN or Infinity)
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

// ─── Tier Classification ──────────────────────────────────────────────────────

const TIER_ORDER: EngagementTier[] = ['new', 'unreliable', 'regular', 'champion'];

/**
 * Classifies a student into an engagement tier based on their metrics and anomaly score.
 *
 * Tier logic (checked in order):
 *   1. If insufficient data (< 3 registrations) → 'new'
 *   2. If any unreliable trigger fires → 'unreliable'
 *   3. If ALL champion conditions met → 'champion'
 *   4. If ALL regular conditions met → 'regular'
 *   5. Default → 'new'
 */
export function classifyTier(
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

// ─── Score Computation ────────────────────────────────────────────────────────

/**
 * Computes a 0–100 reliability score from metrics and anomaly score.
 *
 * The score uses 7 weighted components:
 *   - attendance rate (40pts): core signal
 *   - recent attendance (15pts): trend/recency
 *   - cancellation rate (10pts): commitment
 *   - confirmation speed (5pts): responsiveness
 *   - waitlist behavior (10pts): combo of abandon + conversion
 *   - anomaly score (15pts): ML signal
 *   - bulk registration (5pts): anti-gaming
 *
 * Returns null if insufficient data (< 3 registrations).
 */
export function computeScore(metrics: ReliabilityMetrics, anomalyScore: number): number | null {
  if (metrics.totalRegistrations < ML_THRESHOLDS.reliability.minRegistrationsToScore) return null;

  const w = MODEL_PARAMS.SCORE_WEIGHTS;

  // Each component is normalized to 0–1 before multiplying by its weight
  const attendanceComponent = metrics.attendanceRate * w.attendance;
  const recentComponent = metrics.recentAttendanceRate * w.recentAttendance;
  const cancellationComponent = (1 - Math.min(metrics.cancellationRate, 1)) * w.cancellation;

  // Confirmation speed: 0h = perfect (1.0), 48h = worst (0.0)
  const confirmationNorm = Math.min(metrics.confirmationResponseHours / 48, 1);
  const confirmationComponent = (1 - confirmationNorm) * w.confirmationSpeed;

  // Waitlist behavior: combination of low abandon + high conversion
  const waitlistBehavior = ((1 - metrics.waitlistAbandonRate) + metrics.waitlistConversionRate) / 2;
  const waitlistComponent = waitlistBehavior * w.waitlistBehavior;

  const anomalyComponent = (1 - Math.min(anomalyScore, 1)) * w.anomaly;

  // Bulk registration: 0 = good (1.0), 10+ = bad (0.0)
  const bulkRegNorm = Math.min(metrics.bulkRegistrationScore / 10, 1);
  const bulkComponent = (1 - bulkRegNorm) * w.bulkRegistration;

  const raw = attendanceComponent + recentComponent + cancellationComponent +
              confirmationComponent + waitlistComponent + anomalyComponent + bulkComponent;

  return Math.round(Math.min(Math.max(raw, 0), 100));
}

// ─── Tier Benefits ────────────────────────────────────────────────────────────

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

// ─── Per-User Mutex ───────────────────────────────────────────────────────────

/** Prevents concurrent reliability updates for the same user.
 *  If a new update is requested while one is in-flight, it is deferred
 *  and re-triggered after the current one finishes. */
const inflightUpdates = new Map<string, Promise<ReliabilityResult | null>>();
const pendingRetries = new Map<string, boolean>();

// ─── Main Update Function ─────────────────────────────────────────────────────

/**
 * Recomputes and persists the reliability score and tier for a student.
 *
 * Called fire-and-forget after every write event (register, check-in, cancel, waitlist leave).
 * Uses a per-user mutex: if an update is already in-flight, a re-run is scheduled
 * after the current one finishes so no updates are lost.
 *
 * @param userId - Student user ID to update
 * @returns The computed reliability result, or null if skipped
 */
export async function updateStudentReliability(userId: string): Promise<ReliabilityResult | null> {
  // If an update is already in-flight, defer a re-run instead of skipping
  if (inflightUpdates.has(userId)) {
    pendingRetries.set(userId, true);
    return inflightUpdates.get(userId) ?? null;
  }

  const promise = _doUpdateReliability(userId);
  inflightUpdates.set(userId, promise);

  promise.finally(async () => {
    inflightUpdates.delete(userId);
    // If a retry was requested while we were running, run again with fresh data
    if (pendingRetries.has(userId)) {
      pendingRetries.delete(userId);
      // Small delay to let DB writes from the previous run propagate
      await new Promise(r => setTimeout(r, 100));
      void updateStudentReliability(userId).catch(err =>
        console.error('[Reliability] Deferred update failed:', err)
      );
    }
  });

  return promise;
}

async function _doUpdateReliability(userId: string): Promise<ReliabilityResult | null> {
  const prevUser = await User.findById(userId).select('reliabilityScore engagementTier adminOverriddenTier').lean();
  const prevData = prevUser as any;

  const prevTier = prevData?.engagementTier ?? 'new';
  const retentionDays = MODEL_PARAMS.RETENTION_DAYS[prevTier] ?? 60;
  const metrics = await computeMetrics(userId, retentionDays);

  // Guard: if no registrations found, don't recalculate
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

  const wasAdminOverridden = prevData?.adminOverriddenTier ?? false;

  let anomalyScore = 0;

  // Non-blocking: if reliability model isn't ready, start training in background
  if (!isReliabilityModelReady()) {
    if (!reliabilityTrainingPromise) {
      reliabilityTrainingPromise = trainReliabilityModel().finally(() => {
        reliabilityTrainingPromise = null;
      });
    }
    // Skip anomaly scoring — use heuristic-based tier classification
  }

  if (isReliabilityModelReady() && metrics.totalRegistrations >= ML_THRESHOLDS.reliability.minRegistrationsToScore) {
    try {
      anomalyScore = reliabilityModel!.anomalyScore(buildFeatureVector(metrics));
    } catch (err) {
      console.error('[ReliabilityIF] Scoring failed:', err);
      anomalyScore = 0;
    }
  }

  // Admin override is absolute — don't touch tier/score while active
  if (wasAdminOverridden) {
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

  const tier = classifyTier(metrics, anomalyScore);
  const score = computeScore(metrics, anomalyScore);
  const benefits = getTierBenefits(tier);

  const historyEntry = {
    score: score ?? 0,
    tier,
    reason: buildScoreChangeReason(tier, metrics, anomalyScore),
    changedAt: new Date(),
  };

  const updateData: Record<string, any> = {
    engagementTier: tier,
    reliabilityScore: score,
    $push: {
      scoreHistory: {
        $each: [historyEntry],
        $position: 0,
        $slice: 20,
      },
    },
  };

  await User.findByIdAndUpdate(userId, updateData)
    .catch(err => console.error('[Reliability] Failed to save tier:', err));

  return {
    tier,
    score: score ?? 0,
    anomalyScore: Math.round(anomalyScore * 1000) / 1000,
    metrics,
    confirmationWindowHours: benefits.confirmationWindowHours,
    waitlistMultiplier: benefits.waitlistMultiplier,
  };
}

// ─── Score Change Reason Builder ──────────────────────────────────────────────

let updatesSinceRetrain = 0;

function buildScoreChangeReason(
  tier: string,
  metrics: ReliabilityMetrics,
  anomalyScore: number
): string {
  const champRate = Math.round(TIER_CONFIG.champion.minAttendanceRate * 100);
  const attendedPct = Math.round(metrics.attendanceRate * 100);
  const hasPastEvents = metrics.pastEventCount > 0;

  // Guard: no past events yet
  if (!hasPastEvents && metrics.totalAttended === 0 && metrics.totalRegistrations >= ML_THRESHOLDS.reliability.minRegistrationsToScore) {
    return `${metrics.totalRegistrations} registrations (all future events) — score pending attendance data`;
  }

  // Unreliable reasons (highest priority)
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
