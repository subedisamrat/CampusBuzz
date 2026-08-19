// src/lib/constants/flagMessages.ts
// ─────────────────────────────────────────────────────────────────────────────
// Flag reasoning message library.
// Add new messages to any array to expand the system's vocabulary.
// Templates use {placeholder} syntax — filled by flagReasoning.ts at runtime.
// Variables available: {hour}, {rate}, {total}, {attended}, {noShows},
//   {minutesAgo}, {daysOld}, {minutesEarly}, {minutesLate}, {count},
//   {score}, {signals}, {category}, {eventHour}, {hoursGap}
// ─────────────────────────────────────────────────────────────────────────────

export const FLAG_MESSAGES = {

  // ── Unusual check-in hour (early morning or very late night) ──────────────
  // Triggered when: hourOfDay feature indicates check-in outside 6:00-22:00
  unusualHour: {
    flagged: [
      'Check-in recorded at {hour}:00 — {hoursGap}h before event start.',
      'Entry scan at {hour}:00 falls outside normal check-in hours for this event.',
      'Scan timestamp ({hour}:00) deviates significantly from the event schedule.',
      'Check-in at {hour}:00 — the event is not scheduled to begin until {eventHour}:00.',
      'Entry attempt at {hour}:00 is outside the expected check-in window.',
      'Scan registered at {hour}:00, which is an unusual time for this type of event.',
    ],
    blocked: [
      'Entry blocked: scan at {hour}:00 is {hoursGap}h before doors open.',
      'Access denied: {hour}:00 check-in is inconsistent with event schedule.',
      'Blocked at {hour}:00 — entry window does not open until {eventHour}:00.',
    ],
  },

  // ── Registration created very recently before check-in ────────────────────
  // Triggered when: daysSinceReg feature is very low (< 0.01 normalised)
  // Suggests: QR code may have been shared — genuine students register days ahead
  lastMinuteRegistration: {
    flagged: [
      'Registration created {minutesAgo} minutes before this check-in attempt.',
      'Account registered for this event only {minutesAgo} min ago.',
      'Very short gap between registration and entry scan ({minutesAgo} minutes).',
      'Registration-to-checkin interval of {minutesAgo} minutes is unusually short.',
      'Student registered {minutesAgo} minutes before attempting entry.',
    ],
    blocked: [
      'Entry blocked: registration created {minutesAgo} minutes ago — pattern inconsistent with genuine attendance.',
      'Blocked: {minutesAgo}-minute gap between registration and scan is below the minimum expected interval.',
    ],
  },

  // ── Brand new or very young account ───────────────────────────────────────
  // Triggered when: accountAgeDays feature is very low
  newAccount: {
    flagged: [
      'Account created {daysOld} day(s) ago with no prior attendance history.',
      'Insufficient event history to establish a reliable check-in pattern ({daysOld} days old).',
      'First-time check-in from an account created {daysOld} day(s) ago.',
      'No attendance record exists for this account prior to this event.',
      'Account age of {daysOld} day(s) provides insufficient verification baseline.',
    ],
    blocked: [
      'Entry blocked: account is {daysOld} day(s) old with no verifiable history.',
      'Blocked: account created {daysOld} day(s) ago with no established attendance pattern.',
    ],
  },

  // ── Low historical attendance rate ────────────────────────────────────────
  // Triggered when: checkinRate (historical attendance/confirmation ratio) is very low
  lowAttendanceRate: {
    flagged: [
      'Historical attendance rate is {rate}% — significantly below the platform average.',
      'Student confirmed {total} registrations but attended only {attended}.',
      'Attendance record shows {noShows} previous no-shows from {total} confirmed registrations.',
      'Prior attendance rate of {rate}% across {total} events raises a verification concern.',
      'Only {attended} of {total} confirmed registrations resulted in actual attendance.',
      'Attendance history: {attended} attended out of {total} confirmed ({rate}%).',
    ],
    blocked: [
      'Entry blocked: attendance rate of {rate}% across {total} prior registrations is below the threshold.',
      'Blocked: {noShows} previous no-shows from {total} confirmed registrations.',
    ],
  },

  // ── Check-in very early relative to event start ───────────────────────────
  // Triggered when: minutesRelativeToStart is strongly negative (very early)
  veryEarly: {
    flagged: [
      'Check-in scan is {minutesEarly} minutes before event start.',
      'Entry attempted {minutesEarly} min ahead of the event opening time.',
      'Scan registered {minutesEarly} minutes before scheduled doors-open.',
      'Check-in {minutesEarly} min early — outside normal arrival window.',
      'Entry scan at {minutesEarly} minutes before start time.',
    ],
    blocked: [
      'Entry blocked: check-in is {minutesEarly} minutes before the event opens.',
      'Blocked: {minutesEarly}-minute early scan is outside the allowed entry window.',
    ],
  },

  // ── Check-in very late (event nearly ended or already over) ───────────────
  // Triggered when: minutesRelativeToStart is strongly positive (very late)
  veryLate: {
    flagged: [
      'Check-in recorded {minutesLate} minutes after event start — event may be ending.',
      'Entry scan at {minutesLate} min past start — approaching event end.',
      'Late entry detected: {minutesLate} minutes after the event began.',
      'Check-in {minutesLate} minutes after event start time.',
    ],
    blocked: [
      'Entry blocked: event has been running for {minutesLate} minutes — check-in window is closed.',
      'Blocked: {minutesLate} minutes past event start — entry window has likely ended.',
    ],
  },

  // ── Multiple check-ins in the same day ────────────────────────────────────
  // Triggered when: checkinsPerDay feature shows unusually high same-day count
  multipleCheckins: {
    flagged: [
      'Student has {count} check-in(s) recorded today across different events.',
      '{count} check-ins detected today — above the expected single-event pattern.',
      'Multiple event entries recorded today ({count} total).',
      'This is check-in {count} for this student today.',
    ],
    blocked: [
      'Entry blocked: {count} check-ins today is above the expected pattern for a single student.',
      'Blocked: {count} same-day check-ins detected — exceeds expected attendance pattern.',
    ],
  },

  // ── No prior attendance in this event category ────────────────────────────
  // Triggered when: sameCategoryCount is very low (first time in this category)
  newCategory: {
    flagged: [
      'No prior attendance recorded in {category} events.',
      'Student has no history in the {category} category.',
      'First check-in in a {category} event — no baseline for comparison.',
      'Insufficient {category} event history to verify pattern.',
    ],
  },

  // ── Multiple anomaly signals triggered together ───────────────────────────
  // Used when 2+ categories above are triggered simultaneously.
  // {signals} is a comma-separated list of the individual findings.
  combined: {
    flagged: [
      'Multiple verification signals triggered: {signals}.',
      'Combined anomaly pattern detected — {signals}.',
      'Flagged for admin review: {signals}.',
      'Several unusual patterns found simultaneously: {signals}.',
      'Verification required — combined signals: {signals}.',
      'Anomaly across multiple factors: {signals}.',
    ],
    blocked: [
      'Entry blocked — combined anomaly signals exceed threshold: {signals}.',
      'Access denied pending admin review. Signals: {signals}.',
      'Blocked: multiple concurrent anomalies — {signals}.',
    ],
  },

  // ── General fallback ───────────────────────────────────────────────────────
  // Used when no specific feature stands out but overall anomaly score is high.
  general: {
    flagged: [
      'Check-in pattern deviates from the established normal behaviour profile.',
      'Anomaly score of {score}% exceeds the flag threshold. Admin review recommended.',
      'Verification required — check-in pattern is statistically unusual.',
      'Behaviour profile does not match the expected attendance pattern for this student.',
      'Statistical anomaly detected in check-in data. Score: {score}%.',
      'Check-in characteristics are outside the normal distribution for this platform.',
    ],
    blocked: [
      'Entry blocked — anomaly score of {score}% exceeds the block threshold.',
      'Access denied — check-in pattern requires admin verification before entry.',
      'Entry held: anomaly score {score}%. Please contact the event organiser.',
      'Blocked: overall anomaly score ({score}%) is above the automatic block threshold.',
    ],
  },

  // ── Admin review prompt (appended to flagged reasons) ─────────────────────
  // These short phrases are added at the end of flagged (not blocked) messages
  // to remind the admin what action is needed.
  reviewPrompt: [
    'Recommend admin verification before approving entry.',
    'Please review before approving.',
    'Admin review recommended.',
    'Verify with student before allowing entry.',
  ],

} as const;

// ── Signal short labels ───────────────────────────────────────────────────────
// Used to build the {signals} string in combined messages.
// Keep these short — they appear as a comma-separated list.
export const FLAG_SIGNAL_LABELS = {
  unusualHour:      'unusual check-in time ({hour}:00)',
  lastMinuteReg:    'registered {minutesAgo} min before scan',
  newAccount:       'account only {daysOld} day(s) old',
  lowAttendance:    'attendance rate {rate}%',
  veryEarly:        '{minutesEarly} min before doors open',
  veryLate:         '{minutesLate} min after event start',
  multipleCheckins: '{count} check-ins today',
  noHistory:        'no prior {category} attendance',
} as const;
