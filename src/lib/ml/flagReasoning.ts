// src/lib/ml/flagReasoning.ts
// ─────────────────────────────────────────────────────────────────────────────
// Deterministic flag reason generation. No external calls, no randomness.
// Same registrationId always produces the same message.
// ─────────────────────────────────────────────────────────────────────────────
import { FLAG_MESSAGES, FLAG_SIGNAL_LABELS } from '@/lib/constants';

// ── Feature vector indices ─────────────────────────────────────────────────
// Must match the order returned by checkinFeatures.ts extractFeatures().
// NOTE: checkinFeatures.ts returns RAW values, not normalised 0-1.
//   hourOfDay          → actual hour 0–23
//   daysSinceReg       → actual days (0.003 = ~4 minutes)
//   totalRegistrations → actual count
//   checkinRate        → ratio 0–1
//   minutesRelToStart  → actual minutes (negative = early, positive = late)
//   sameCategoryCount  → actual count
//   checkinsPerDayNorm → normalised 0–1 (1 = 5+ per day)
//   accountAgeNorm     → normalised 0–1 (1 = 1 year)
const F = {
  hourOfDay:              0,
  daysSinceReg:           1,
  totalRegistrations:     2,
  checkinRate:            3,
  minutesRelativeToStart: 4,
  sameCategoryCount:      5,
  checkinsPerDay:         6,  // normalised: 0-1, 1 = 5+ per day
  accountAgeDays:         7,  // normalised: 0-1, 1 = 1 year
} as const;

// ── Cache: avoid re-computing for the same registration ───────────────────
const reasonCache = new Map<string, string>();
// Clear every hour so stale data doesn't persist indefinitely
const _cacheCleanupInterval = setInterval(() => reasonCache.clear(), 60 * 60 * 1000);
// Allow Node.js to exit even if this interval is pending
if (typeof _cacheCleanupInterval === 'object' && _cacheCleanupInterval.unref) {
  _cacheCleanupInterval.unref();
}

// ── Template filler ────────────────────────────────────────────────────────
function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`
  );
}

// ── Deterministic index from registrationId ───────────────────────────────
// Picks from an array without randomness so the same registration always
// gets the same message on repeated calls.
function pick<T>(arr: readonly T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  return arr[Math.abs(hash) % arr.length];
}

// ── Feature interpretation ────────────────────────────────────────────────
// Maps raw feature values from checkinFeatures.ts to human-readable context.
interface FeatureContext {
  hour:            number;   // actual hour 0–23
  minutesAgo:      number;   // minutes since registration (from raw daysSinceReg in days)
  daysOld:         number;   // account age in days (from normalised accountAgeNorm)
  attendanceRate:  number;   // 0–100 percentage (from checkinRate 0-1)
  totalReg:        number;   // total registrations (raw count)
  minutesRelative: number;   // minutes relative to event start (raw)
  checkinsToday:   number;   // check-ins today (from normalised checkinsPerDayNorm)
  categoryCount:   number;   // prior same-category check-ins (raw count)
  anomalyScore:    number;   // 0–100 percentage
}

function interpretFeatures(features: number[], anomalyScore: number): FeatureContext {
  return {
    // hourOfDay is raw 0-23
    hour: Math.round(features[F.hourOfDay] ?? 12),
    // daysSinceReg is actual days — convert to minutes
    minutesAgo: Math.round((features[F.daysSinceReg] ?? 0.1) * 1440),
    // accountAgeDays is normalised 0-1 (1 = 365 days) — convert to days
    daysOld: Math.round((features[F.accountAgeDays] ?? 0.5) * 365),
    // checkinRate is ratio 0-1 — convert to percentage
    attendanceRate: Math.round((features[F.checkinRate] ?? 0.5) * 100),
    // totalRegistrations is raw count
    totalReg: Math.round(features[F.totalRegistrations] ?? 0),
    // minutesRelativeToStart is raw minutes
    minutesRelative: Math.round(features[F.minutesRelativeToStart] ?? 0),
    // checkinsPerDay is normalised 0-1 (1 = 5 per day) — convert to count
    checkinsToday: Math.round((features[F.checkinsPerDay] ?? 0) * 5),
    // sameCategoryCount is raw count
    categoryCount: Math.round(features[F.sameCategoryCount] ?? 0),
    // anomalyScore comes as 0-1 — convert to 0-100
    anomalyScore: Math.round(anomalyScore * 100),
  };
}

// ── Main exported function ────────────────────────────────────────────────
export function generateFlagReason(
  features: number[],
  anomalyScore: number,
  severity: 'flagged' | 'blocked',
  registrationId: string = 'unknown'
): string {
  // Return cached result for the same registration + severity combination
  const cacheKey = `${registrationId}-${severity}`;
  const cached = reasonCache.get(cacheKey);
  if (cached) return cached;

  const ctx = interpretFeatures(features, anomalyScore);

  // ── Identify which signals are anomalous ──────────────────────────────
  type SignalKey = keyof typeof FLAG_SIGNAL_LABELS;
  const triggeredSignals: SignalKey[] = [];

  // Unusual hour: before 6am or after 10pm
  if (ctx.hour < 6 || ctx.hour > 22) {
    triggeredSignals.push('unusualHour');
  }

  // Last-minute registration: registered less than 20 minutes before check-in
  if (ctx.minutesAgo < 20) {
    triggeredSignals.push('lastMinuteReg');
  }

  // Brand new account: less than 3 days old
  if (ctx.daysOld < 3) {
    triggeredSignals.push('newAccount');
  }

  // Low attendance rate: below 25% with at least 3 prior registrations
  if (ctx.attendanceRate < 25 && ctx.totalReg >= 3) {
    triggeredSignals.push('lowAttendance');
  }

  // Very early check-in: more than 60 minutes before event start
  if (ctx.minutesRelative < -60) {
    triggeredSignals.push('veryEarly');
  }

  // Very late check-in: more than 90 minutes after event start
  if (ctx.minutesRelative > 90) {
    triggeredSignals.push('veryLate');
  }

  // Multiple check-ins today: 3 or more
  if (ctx.checkinsToday >= 3) {
    triggeredSignals.push('multipleCheckins');
  }

  // No history in this category (categoryCount = 0 raw)
  if (ctx.categoryCount === 0) {
    triggeredSignals.push('noHistory');
  }

  // ── Build template variables ─────────────────────────────────────────
  // eventHour is approximated — event likely starts ~8h after an unusual early check-in
  const eventHour = ((ctx.hour + 8) % 24);
  const vars: Record<string, string | number> = {
    hour:         ctx.hour,
    eventHour,
    hoursGap:     Math.abs(Math.round(ctx.minutesRelative / 60)),
    minutesAgo:   ctx.minutesAgo,
    daysOld:      ctx.daysOld,
    rate:         ctx.attendanceRate,
    total:        ctx.totalReg,
    attended:     Math.round(ctx.totalReg * ctx.attendanceRate / 100),
    noShows:      Math.round(ctx.totalReg * (1 - ctx.attendanceRate / 100)),
    minutesEarly: Math.abs(ctx.minutesRelative),
    minutesLate:  ctx.minutesRelative,
    count:        ctx.checkinsToday,
    score:        ctx.anomalyScore,
    category:     'this',  // category name not encoded in feature vector
  };

  let reason: string;

  // ── Select message template ───────────────────────────────────────────
  if (triggeredSignals.length >= 2) {
    // Multiple signals: build combined message
    const signalStrings = triggeredSignals.map(sig =>
      fill(FLAG_SIGNAL_LABELS[sig as keyof typeof FLAG_SIGNAL_LABELS], vars)
    );
    vars.signals = signalStrings.join('; ');

    const templates =
      (FLAG_MESSAGES.combined as Record<string, readonly string[]>)[severity] ??
      FLAG_MESSAGES.combined.flagged;
    reason = fill(pick(templates, registrationId), vars);

  } else if (triggeredSignals.length === 1) {
    // Single signal: use the specific category messages
    const signal = triggeredSignals[0];
    const categoryMap: Partial<Record<SignalKey, keyof typeof FLAG_MESSAGES>> = {
      unusualHour:      'unusualHour',
      lastMinuteReg:    'lastMinuteRegistration',
      newAccount:       'newAccount',
      lowAttendance:    'lowAttendanceRate',
      veryEarly:        'veryEarly',
      veryLate:         'veryLate',
      multipleCheckins: 'multipleCheckins',
      noHistory:        'newCategory',
    };

    const msgCategory = categoryMap[signal];
    if (msgCategory) {
      const categoryMsgs = FLAG_MESSAGES[msgCategory] as Record<string, readonly string[]>;
      const templates = categoryMsgs[severity] ?? categoryMsgs['flagged'];
      reason = fill(pick(templates, registrationId), vars);
    } else {
      const fallback =
        (FLAG_MESSAGES.general as Record<string, readonly string[]>)[severity] ??
        FLAG_MESSAGES.general.flagged;
      reason = fill(pick(fallback, registrationId), vars);
    }

  } else {
    // No specific signal triggered: use general fallback
    const fallback =
      (FLAG_MESSAGES.general as Record<string, readonly string[]>)[severity] ??
      FLAG_MESSAGES.general.flagged;
    reason = fill(pick(fallback, registrationId), vars);
  }

  // Append review prompt for flagged (not blocked) entries
  if (severity === 'flagged' && FLAG_MESSAGES.reviewPrompt.length > 0) {
    const prompt = pick(FLAG_MESSAGES.reviewPrompt, registrationId + '-prompt');
    reason = `${reason} ${prompt}`;
  }

  reasonCache.set(cacheKey, reason);
  return reason;
}

// ── Convenience wrapper for async contexts ────────────────────────────────
// Maintains the same async signature as the old implementation so all
// existing callers (checkin/route.ts etc.) need zero changes.
export async function generateFlagReasonAsync(
  features: number[],
  anomalyScore: number,
  severity: 'flagged' | 'blocked',
  registrationId?: string
): Promise<string> {
  return generateFlagReason(features, anomalyScore, severity, registrationId);
}
