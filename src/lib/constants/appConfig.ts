// src/lib/constants/appConfig.ts
// ─────────────────────────────────────────────────────────────────────────────
// Change values here to update them everywhere in the application.
// This file is the single source of truth for all app-level configuration.
// ─────────────────────────────────────────────────────────────────────────────

// ── Core App Identity ────────────────────────────────────────────────────────
export const APP_CONFIG = {
  name:           'CampusBuzz',
  tagline:        'Discover campus events you will love',
  description:    'Campus Event Management Platform for students and organisers',
  college:        'Tribhuvan University — Humanities and Social Science',
  collegeShort:   'FOHSS',
  academicYear:   '2082/083',
  contactEmail:   'campusbuzz@fohss.np',
  supportEmail:   'support@campusbuzz.np',
  adminEmail:     'admin@campusbuzz.np',
  baseUrl:        process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  version:        '1.0.0',
} as const;

// ── Navigation Links ──────────────────────────────────────────────────────────
// All internal and external links in one place.
// Change href here → updates NavBar, Footer, 404 page, emails automatically.
export const APP_LINKS = {
  // Public pages
  home:           '/',
  events:         '/events',
  login:          '/auth/login',
  signup:         '/auth/signup',

  // Student pages
  myEvents:       '/my-events',
  myPayments:     '/my-payments',
  myReliability:  '/my-reliability',

  // Admin pages
  adminDashboard: '/admin/dashboard',
  adminEvents:    '/admin/events',
  adminScanner:   '/admin/scanner',
  adminFlagged:   '/admin/flagged',
  adminStudents:  '/admin/students',
  adminPayments:  '/admin/payments',
  adminAnalytics: '/admin/analytics',

  // Policy pages
  privacyPolicy:  '/privacy',
  termsOfService: '/terms',

  // External
  khaltiDocs:     'https://docs.khalti.com',
  esewaGuide:     'https://developer.esewa.com.np',
  githubRepo:     'https://github.com/campusbuzz',
} as const;

// ── Feature Flags ─────────────────────────────────────────────────────────────
// Toggle entire features on/off without touching any business logic.
// Set to false to disable a feature for testing or staged rollout.
export const FEATURE_FLAGS = {
  // Core features
  enableWaitlist:             true,
  enablePayments:             true,
  enableRecommendations:      true,
  enableReliabilityScoring:   true,
  enableAutoConfirmations:    true,
  enableEventInterest:        true,

  // Communication
  enableEmailNotifications:   true,
  enableInAppNotifications:   true,
  enableEventReminders:       true,
  enableCapacityAlerts:       true,

  // Admin features
  enableActivityLog:          true,
  enableBanSystem:            true,
  enableManualTierOverride:   true,
  enableAIFlagReasoning:      false, // Uses structured reasoning instead
  enableBulkConfirmations:    true,

  // UX features
  enablePrintTicket:          true,
  enableShareButton:          true,
  enableCancelRegistration:   true,

  // Development
  showDebugPanels:    process.env.NODE_ENV === 'development',
  logPerformance:     process.env.NODE_ENV === 'development',
} as const;

// ── Landing Page Content ──────────────────────────────────────────────────────
// Edit these to update landing page features section without touching components.
// icon field must be a valid Lucide icon name (imported in the component).
export const LANDING_FEATURES = [
  {
    iconName:  'Calendar',
    title:     'Discover Events',
    desc:      'Browse Technical fests, Cultural nights, Sports meets and more across your campus.',
    colorClass: 'text-teal-500',
    bgClass:    'bg-teal-500/10',
  },
  {
    iconName:  'QrCode',
    title:     'QR Check-in',
    desc:      'Get your unique QR code instantly on registration. Scan and verify at the entrance.',
    colorClass: 'text-rose-500',
    bgClass:    'bg-rose-500/10',
  },
  {
    iconName:  'BarChart3',
    title:     'Live Dashboard',
    desc:      'Admins track registrations, attendance and analytics in real time.',
    colorClass: 'text-amber-500',
    bgClass:    'bg-amber-500/10',
  },
  {
    iconName:  'Shield',
    title:     'Smart Priority',
    desc:      'ML-powered waitlist gives priority to students with strong attendance history.',
    colorClass: 'text-violet-400',
    bgClass:    'bg-violet-400/10',
  },
  {
    iconName:  'Brain',
    title:     'Fraud Detection',
    desc:      'Isolation Forest algorithm flags suspicious check-in patterns automatically.',
    colorClass: 'text-cyan-400',
    bgClass:    'bg-cyan-400/10',
  },
  {
    iconName:  'Star',
    title:     'Reliability Tiers',
    desc:      'Attend events consistently to unlock Champion status and exclusive benefits.',
    colorClass: 'text-amber-400',
    bgClass:    'bg-amber-400/10',
  },
] as const;

// ── FAQ Content ───────────────────────────────────────────────────────────────
// Add, remove, or edit FAQ questions here.
// They render in the FaqSection component on the landing page automatically.
export const FAQ_ITEMS = [
  {
    q: 'How do I register for an event?',
    a: `Browse events, click on one you like, and click Register. For free events you will receive a confirmation email with your QR code. For paid events, complete payment through Khalti or eSewa.`,
  },
  {
    q: 'What is the QR code for?',
    a: `After confirming your registration you receive a unique QR code. Show it to the organiser at the event entrance for instant check-in. View it anytime on your My Events page.`,
  },
  {
    q: 'What happens if an event is full?',
    a: `You can join the waitlist. When a spot opens, you are automatically notified and your registration is created. Students with better attendance history get priority in the queue regardless of when they joined.`,
  },
  {
    q: 'Are event fees refundable?',
    a: `Ticket fees are non-refundable unless the event is cancelled by the organiser. If an event is cancelled, refunds are processed through the original payment gateway within 3-5 business days.`,
  },
  {
    q: 'What is the reliability score?',
    a: `Your reliability score is calculated by a machine learning algorithm based on your attendance history, waitlist behaviour, and registration patterns. Higher scores unlock benefits like extended confirmation windows and waitlist priority.`,
  },
  {
    q: 'How do I confirm my registration?',
    a: `After registering for a free event, check your email for a confirmation link. Click it within your deadline window. Your QR code is sent upon confirmation. The deadline depends on your tier.`,
  },
  {
    q: 'Can I cancel my registration?',
    a: `Free event registrations can be cancelled from My Events before the event starts, as long as you have not yet confirmed attendance. Paid registrations are non-refundable per our ticket policy.`,
  },
  {
    q: 'What is Champion tier?',
    a: `Champion is the highest reliability tier. It requires attending at least 8 events with a 70% or higher attendance rate. Champions get extended confirmation windows and 2× priority on waitlists.`,
  },
  {
    q: 'My account shows restricted access. What does this mean?',
    a: `Your account has been temporarily restricted from registering for new events. Please visit the admin office with your student ID card to discuss your account status and the steps to restore full access.`,
  },
] as const;

// ── Footer Links ──────────────────────────────────────────────────────────────
// Rendered by the Footer component — edit here to update the footer.
export const FOOTER_LINKS = {
  quickLinks: [
    { label: 'Browse Events', href: APP_LINKS.events },
    { label: 'Create Account', href: APP_LINKS.signup },
    { label: 'Sign In', href: APP_LINKS.login },
  ],
  technology: [
    'Next.js 14 App Router',
    'Collaborative Filtering',
    'Isolation Forest ML',
    'Min-Heap Waitlist Priority',
    'Khalti & eSewa Payments',
  ],
  contact: [
    { label: 'General',  href: `mailto:${APP_CONFIG.contactEmail}` },
    { label: 'Support',  href: `mailto:${APP_CONFIG.supportEmail}` },
  ],
} as const;

// ── Tech Stack Labels ─────────────────────────────────────────────────────────
// Shown in the Algorithm Insights widget and footer.
export const ALGORITHM_LABELS = {
  checkinIF:      'Isolation Forest (Check-in)',
  reliabilityIF:  'Isolation Forest (Reliability)',
  decisionTree:   'Decision Tree (Tier Classification)',
  minHeap:        'Min-Heap Priority Queue (Waitlist)',
  collab:         'Collaborative Filtering (Recommendations)',
  idf:            'IDF-Weighted Cosine Similarity',
} as const;
