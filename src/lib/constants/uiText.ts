// src/lib/constants/uiText.ts
// ─────────────────────────────────────────────────────────────────────────────
// All user-facing text strings. Edit here to change wording sitewide.
// Import: import { UI_TEXT } from '@/lib/constants'
// ─────────────────────────────────────────────────────────────────────────────

// ── Tier Benefit Descriptions ─────────────────────────────────────────────────
// These appear in ReliabilityCard, event detail page, and confirmation emails.
// They use {windowHours}, {multiplier} as placeholders — replaced at render time
// using the actual TIER_CONFIG values.
export const TIER_BENEFIT_TEXT = {
  champion: {
    primary:      '{windowHours}h to confirm free event spots',
    secondary:    '{multiplier}× priority bonus on all waitlists',
    badge:        'Champion',
    studentBadge: 'Champion',
    tone:         'You are among the most reliable students on campus.',
  },
  regular: {
    primary:      '{windowHours}h to confirm free event spots',
    secondary:    '1× standard waitlist priority',
    badge:        'Regular',
    studentBadge: 'Regular',
    tone:         'Keep attending events to improve your standing.',
  },
  new: {
    primary:      '{windowHours}h to confirm free event spots',
    secondary:    'No waitlist bonus yet — build your history first',
    badge:        'New',
    studentBadge: 'Getting Started',
    tone:         'Attend your first events to unlock your reliability score.',
  },
  unreliable: {
    primary:      '{windowHours}h to confirm (stricter window)',
    secondary:    'No waitlist priority bonus',
    badge:        'Low History',
    studentBadge: 'Build Your History',
    tone:         'Attend your registered events to improve your score.',
  },
} as const;

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

// ── Toast Messages ─────────────────────────────────────────────────────────────
// All toast notifications. Never use toast.success("hardcoded string").
// Import TOAST and use TOAST.registrationSuccess etc.
export const TOAST = {
  // Registration
  registrationSuccess:       'Registration submitted. Check your email to confirm.',
  registrationConfirmed:     'Attendance confirmed. Your QR code has been emailed.',
  registrationCancelled:     'Registration cancelled successfully.',
  registrationExists:        'You are already registered for this event.',
  registrationFull:          'This event is now full. You can join the waitlist.',

  // Waitlist
  waitlistJoined:            'Added to waitlist. You will be notified when a spot opens.',
  waitlistLeft:              'Removed from waitlist.',
  waitlistPromoted:          'A spot opened up! Check your email for your QR code.',

  // Payments
  paymentProcessing:         'Redirecting to payment gateway...',
  paymentSuccess:            'Payment confirmed. Your ticket has been emailed.',
  paymentFailed:             'Payment could not be completed. Please try again.',
  refundProcessed:           'Refund has been initiated successfully.',

  // Auth
  loginSuccess:              'Welcome back!',
  loginFailed:               'Invalid email or password.',
  signupSuccess:             'Account created. Welcome to CampusBuzz!',
  logoutSuccess:             'Signed out successfully.',
  sessionExpired:            'Your session has expired. Please sign in again.',

  // Confirmation
  confirmResent:             'Confirmation email resent. Check your inbox and spam folder.',
  confirmExpired:            'Your confirmation link expired. You can register again.',
  confirmationWindowWarning: 'You have {hours}h left to confirm your registration.',

  // Profile
  tierUpdated:               'Student tier updated successfully.',
  tierReset:                 'Student reset to New tier successfully.',
  banApplied:                'Student account has been restricted.',
  banLifted:                 'Student account restriction has been lifted.',

  // Generic errors
  networkError:              'Connection failed. Please check your internet and try again.',
  serverError:               'Something went wrong on our end. Please try again.',
  notFound:                  'The requested item could not be found.',
  forbidden:                 'You do not have permission to perform this action.',
} as const;

// ── Error Messages Shown in UI ─────────────────────────────────────────────────
// API error responses that show up in the frontend.
export const ERROR_TEXT = {
  bannedRegistration: [
    'Your account has been restricted from registering for events.',
    'If you believe this is an error, please visit the admin office',
    'with your student ID card.',
  ].join(' '),
  eventFull:           'This event has reached its capacity.',
  alreadyRegistered:   'You are already registered for this event.',
  eventEnded:          'Registration for this event has closed.',
  confirmationNotSent: 'Confirmation not available yet. Wait for the organiser to send your email.',
  paidCancellation:    'Paid event registrations cannot be cancelled. Contact admin if the event is cancelled.',
  notConfirmed:        'Registration not confirmed. Please confirm attendance via email first.',
} as const;

// ── Email Subjects ─────────────────────────────────────────────────────────────
// All email subject lines in one place.
// {eventName} is replaced at send time.
export const EMAIL_SUBJECTS = {
  registrationFree:   'Confirm your attendance — {eventName}',
  registrationPaid:   'Your ticket for {eventName}',
  waitlistPromotion:  'You are in! A spot opened for {eventName}',
  eventReminder:      'Reminder — {eventName} is tomorrow',
  spotReleased:       'Your registration for {eventName} has been released',
  capacityAlert80:    '80% full — {eventName}',
  capacityAlert100:   'Event is now full — {eventName}',
  spotAvailable:      'Spots Available — {eventName}',
  eventCancelled:     'Event Cancelled — {eventName}',
} as const;

// ── Confirmation Window Display Helper ─────────────────────────────────────────
// Used in UI to display time in human-readable format.
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

// ── Sold Out Stamp Text ────────────────────────────────────────────────────────
export const SOLD_OUT_TEXT = {
  line1:   'SOLD',
  line2:   'OUT',
  tooltip: 'This event has reached capacity',
} as const;
