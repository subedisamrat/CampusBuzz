// ── New constant modules — single import point ────────────────────────────
export * from './appConfig';
export * from './flagMessages';
export * from './uiText';
// ─────────────────────────────────────────────────────────────────────────────

export const EVENT_CATEGORIES = [
  'Technical',
  'Cultural',
  'Sports',
  'Workshop',
  'Seminar',
  'Hackathon',
  'Other',
] as const;

export type EventCategory = typeof EVENT_CATEGORIES[number];

export const CATEGORY_COLORS: Record<EventCategory | string, {
  bg: string;
  text: string;
  border: string;
}> = {
  Technical:  { bg: 'bg-blue-500/10',   text: 'text-blue-300',   border: 'border-blue-500/20'   },
  Cultural:   { bg: 'bg-pink-500/10',   text: 'text-pink-300',   border: 'border-pink-500/20'   },
  Sports:     { bg: 'bg-green-500/10',  text: 'text-green-300',  border: 'border-green-500/20'  },
  Workshop:   { bg: 'bg-amber-500/10',  text: 'text-amber-300',  border: 'border-amber-500/20'  },
  Seminar:    { bg: 'bg-purple-500/10', text: 'text-purple-300', border: 'border-purple-500/20' },
  Hackathon:  { bg: 'bg-cyan-500/10',   text: 'text-cyan-300',   border: 'border-cyan-500/20'   },
  Other:      { bg: 'bg-gray-500/10',   text: 'text-gray-300',   border: 'border-gray-500/20'   },
};

export type EngagementTierType = 'champion' | 'regular' | 'new' | 'unreliable';

export const TIER_CONFIG: Record<EngagementTierType, {
  label: string;
  studentLabel: string;
  confirmationWindowHours: number;
  waitlistMultiplier: number;
  waitlistPenaltyHours: number;
  tierBasePriorityHours: number;
  color: string;
  bgColor: string;
  borderColor: string;
  minAttended: number;
  minAttendanceRate: number;
  minRecentRate: number;
  maxWaitlistAbandon: number;
}> = {
  champion: {
    label: 'Champion',
    studentLabel: 'Champion',
    confirmationWindowHours: 48,
    waitlistMultiplier: 2,
    waitlistPenaltyHours: 0,
    tierBasePriorityHours: 48,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    minAttended: 8,
    minAttendanceRate: 0.85,
    minRecentRate: 0.80,
    maxWaitlistAbandon: 0.20,
  },
  regular: {
    label: 'Regular',
    studentLabel: 'Regular',
    confirmationWindowHours: 24,
    waitlistMultiplier: 1,
    waitlistPenaltyHours: 0,
    tierBasePriorityHours: 24,
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/20',
    minAttended: 3,
    minAttendanceRate: 0.40,
    minRecentRate: 0.00,
    maxWaitlistAbandon: 0.50,
  },
  new: {
    label: 'New',
    studentLabel: 'Getting Started',
    confirmationWindowHours: 24,
    waitlistMultiplier: 0,
    waitlistPenaltyHours: 0,
    tierBasePriorityHours: 0,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    minAttended: 0,
    minAttendanceRate: 0.00,
    minRecentRate: 0.00,
    maxWaitlistAbandon: 1.00,
  },
  unreliable: {
    label: 'Low History',
    studentLabel: 'Build Your History',
    confirmationWindowHours: 12,
    waitlistMultiplier: 0,
    waitlistPenaltyHours: 2,
    tierBasePriorityHours: -2,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    minAttended: 0,
    minAttendanceRate: 0.00,
    minRecentRate: 0.00,
    maxWaitlistAbandon: 1.00,
  },
};

export const ML_THRESHOLDS = {
  checkin: {
    flagThreshold:  0.65,
    blockThreshold: 0.80,
    minTrainSamples: 20,
    retrainAfter: 50,
    numTrees: 100,
    subsampleSize: 256,
  },
  reliability: {
    unreliableAnomalyScore: 0.70,
    unreliableMaxAttendance: 0.25,
    unreliableMaxBulkRegistrations: 6,
    minRegistrationsToScore: 3,
    minStudentsToTrain: 10,
    retrainAfter: 50,
    recentWindowSize: 5,
    maxCancellationRate: 0.50,
    maxResponseTimeHours: 40,
    minWaitlistConversion: 0.30,
  },
} as const;

export const WAITLIST_CONFIG = {
  HOUR_DISCOUNT_MS: 3_600_000,
} as const;

export const CONFIRMATION_CONFIG = {
  autoTriggerDaysBefore: 3,
  manualTriggerMaxDays: 14,
  minHoursBeforeEvent: 2,
  rejoinPenaltyHours: 4,
} as const;

export const RECOMMENDATION_CONFIG = {
  TOP_K: 5,
  CACHE_TTL_MS: 60 * 60 * 1000,
  MIN_NEIGHBOURS: 1,
  MAX_NEIGHBOURS: 10,
} as const;

export const RATE_LIMITS = {
  checkin:  { requests: 30, windowMs: 60_000 },
} as const;

export const SESSION_CONFIG = {
  MAX_AGE_SECONDS: 24 * 60 * 60,
} as const;

export const TIME_UNITS = {
  HOUR_MS: 60 * 60 * 1000,
  DAY_MS:  24 * 60 * 60 * 1000,
} as const;

export const PAGINATION = {
  EVENTS_PER_PAGE: 12,
  LANDING_EVENTS_GUEST: 6,
  LANDING_EVENTS_AUTH: 12,
  TRENDING_LARGE: 6,
  TRENDING_MEDIUM: 3,
} as const;

export const IMAGE_CONFIG = {
  MAX_SIZE_MB: 5,
  ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  PLACEHOLDER: '/images/event-placeholder.jpg',
} as const;

// ─── ML model parameters ─────────────────────────────────────────────────────
export const MODEL_PARAMS = {
  RETENTION_DAYS: {
    champion:   60,
    regular:    60,
    new:        60,
    unreliable: 60,
  } as Record<string, number>,
  /** Score component weights — must sum to 100 */
  SCORE_WEIGHTS: {
    attendance:          40,
    recentAttendance:    15,
    cancellation:        10,
    confirmationSpeed:    5,
    waitlistBehavior:    10,
    anomaly:            15,
    bulkRegistration:     5,
  } as const,
};

export const ISOLATION_FOREST_TREES      = 100;
export const ISOLATION_FOREST_SAMPLE     = 256;

export function getMinDateTime(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

