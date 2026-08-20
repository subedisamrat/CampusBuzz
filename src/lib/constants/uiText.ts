// src/lib/constants/uiText.ts
// ─────────────────────────────────────────────────────────────────────────────
// All user-facing text strings. Edit here to change wording sitewide.
// Import: import { UI_TEXT } from '@/lib/constants'
// ─────────────────────────────────────────────────────────────────────────────

// ── Tier Improvement Tips ──────────────────────────────────────────────────────
// Shown at the bottom of ReliabilityCard and /my-reliability page.
// These are templates — {value} is replaced at render time.
export const TIER_IMPROVEMENT_TEXT = {
  toChampion:        'Attend {needed} more event{s} with {rate}%+ attendance to reach Champion status.',
  toRegular:         'Attend {needed} more event{s} to unlock Regular status.',
  maintainChamp:     'Maintain {rate}%+ attendance rate to keep Champion status.',
  newStudent:        'Attend {attended} of {needed} events to unlock your reliability score.',
  alreadyChamp:      'You are at the top tier. Keep it up!',
  unreliableRate:    'Your attendance rate is {rate}%. Attend your next registered events to improve.',
  unreliableAbandon: 'Keep your next waitlist spot when promoted to improve your reliability score.',
  unreliableBulk:    'Confirm or cancel pending registrations to reduce your unconfirmed count.',
} as const;

// ── Confirmation Window Display Helper ─────────────────────────────────────────
// Takes hours (can be fractional) and returns e.g. "48 hours" or "3 minutes"
export function formatWindowTime(hours: number): string {
  if (hours < 1 / 60) {
    return `${Math.round(hours * 3600)} seconds`;
  }
  if (hours < 1) {
    return `${Math.round(hours * 60)} minutes`;
  }
  if (hours === 1) return '1 hour';
  return `${hours} hours`;
}
