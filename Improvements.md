# CampusBuzz — Final Bug Fixes and Improvements

# Complete Sequential Implementation Guide

> **FOR AI IDE EXECUTING THIS FILE**
>
> READ THE ENTIRE FILE BEFORE WRITING A SINGLE LINE OF CODE.
> Execute tasks in ORDER. Run `npm run build` after every GROUP.
> Never rewrite working logic — only modify what is specified.
> The two critical bugs (score auto-update, ban overlay) must be fixed first.

---

## BEFORE STARTING

```bash
npm run build
```

Confirm 0 TypeScript errors before starting any task.

---

## GROUP A — CRITICAL BUG FIXES

### BUG A1 — Reliability Score Updates on Every Page Visit

#### Root Cause

The `GET /api/user/reliability` route (or `GET /api/user/stats`) is calling
`updateStudentReliability(userId)` inside the handler. This means:

1. Admin views student profile → reads score (e.g. 75)
2. Student logs in → any page load triggers GET /api/user/reliability
3. That route calls updateStudentReliability() → recomputes → saves new value
4. Admin refreshes → sees new value (e.g. 77)

Nothing wrong happened algorithmically. The score recalculated because time-based
features (accountAgeDays, recentAttendanceRate window) produce slightly different
values at different moments. The system is working correctly — it is just being
called at the wrong time.

**The rule:** GET routes must ONLY read. Score recomputation must ONLY happen
after write events.

#### Fix — Remove recomputation from GET routes

**File:** `src/app/api/user/reliability/route.ts`
(or wherever user stats/reliability is fetched)

Find any call to `updateStudentReliability()` or `computeAndSaveReliability()`
inside a GET handler. Remove it entirely.

The GET handler should ONLY read from the database:

```typescript
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Login required" }, { status: 401 });

    await connectDB();

    // READ ONLY — never call updateStudentReliability() here
    const user = (await User.findById(session.user.id)
      .select("engagementTier reliabilityScore scoreHistory")
      .lean()) as any;

    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Also read metrics for display (read-only DB queries)
    const [totalReg, totalAttended, totalConfirmed] = await Promise.all([
      Registration.countDocuments({ userId: session.user.id }),
      Registration.countDocuments({ userId: session.user.id, checkedIn: true }),
      Registration.countDocuments({ userId: session.user.id, confirmed: true }),
    ]);

    const attendanceRate =
      totalConfirmed > 0
        ? Math.round((totalAttended / totalConfirmed) * 100)
        : 0;

    return NextResponse.json({
      tier: user.engagementTier ?? "new",
      score: user.reliabilityScore ?? null,
      scoreHistory: (user.scoreHistory ?? []).slice(0, 10),
      metrics: {
        totalRegistered: totalReg,
        totalAttended,
        attendanceRate,
      },
    });
  } catch (err) {
    console.error("[GET /api/user/reliability]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

#### Fix — Ensure updateStudentReliability is ONLY called after write events

Search the entire codebase for calls to `updateStudentReliability`:

```bash
grep -r "updateStudentReliability\|computeAndSaveReliability\|updateStudentScore" src/
```

For each result, check which HTTP method handler it is in:

- In a POST handler (registration, check-in): KEEP — correct location
- In a DELETE handler (cancel registration): KEEP — correct location
- In a GET handler: REMOVE — wrong location
- In a PUT handler for admin tier update: KEEP — correct location

The only places `updateStudentReliability` should be called:

```typescript
// 1. After successful registration
// POST /api/register → after transaction commits:
void updateStudentReliability(userId).catch((err) =>
  console.error("[Reliability] Post-register update failed:", err),
);

// 2. After successful check-in
// POST /api/checkin → after checkedIn is set to true:
void updateStudentReliability(userId).catch((err) =>
  console.error("[Reliability] Post-checkin update failed:", err),
);

// 3. After registration cancellation
// DELETE /api/register/[eventId] → after deletion:
void updateStudentReliability(userId).catch((err) =>
  console.error("[Reliability] Post-cancel update failed:", err),
);

// 4. After leaving waitlist
// DELETE /api/waitlist/[eventId]:
void updateStudentReliability(userId).catch((err) =>
  console.error("[Reliability] Post-waitlist-leave update failed:", err),
);

// 5. After admin manually updates tier
// PUT /api/admin/students/[userId]/ban or tier update:
// (keep — admin action should persist immediately)

// NEVER in GET handlers
// NEVER in the reliability card component's useEffect
// NEVER on page load
```

#### Verify

```
1. Note student19's current reliabilityScore in MongoDB
2. Login as admin, go to /admin/students → view student19's score
3. Login as student19@campusbuzz.com
4. Navigate to /my-events, /events, /profile — any page
5. Return to admin, refresh student19's profile
6. Confirm score has NOT changed
7. Now perform a write action: register student19 for an event
8. Return to admin — score may now have changed (this is correct)
```

---

### BUG A2 — Ban Overlay Shows to All Students (Not Just Banned)

#### Root Cause — Two problems working together

**Problem 1: Wrong API endpoint usage**

The `BannedOverlay` component calls `GET /api/user/[userId]/ban-status` with a
userId from the URL parameter. But the URL parameter in the route file is taken
from the path, not from the authenticated session. If ANY page passes a userId
that belongs to the banned user (e.g., from a query param or shared URL), every
logged-in user will get the banned user's status returned.

The correct endpoint is `GET /api/user/ban-status` (no userId in path) — it
reads from the session server-side. If your endpoint uses a URL parameter,
any user who visits a URL containing the banned user's ID will appear banned.

**Problem 2: No "seen" flag**

Even if shown to the correct user, the overlay reappears on every single page
navigation because it fetches ban status on every component mount. Since the
component is in `layout.tsx`, it remounts on every route change. The user is
bombarded with the overlay on every click.

#### Fix — Create a session-based ban-status API (no URL param)

**File:** `src/app/api/user/ban-status/route.ts`

Replace entirely with this version that reads from the authenticated session only:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

// GET /api/user/ban-status
// Returns ban status for the CURRENTLY LOGGED IN user only.
// Never accepts a userId parameter — always uses session.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // Not logged in — not banned
    if (!session || !session.user?.id) {
      return NextResponse.json({ isBanned: false });
    }

    // Admins are never banned
    if (session.user.role === "admin") {
      return NextResponse.json({ isBanned: false });
    }

    await connectDB();

    const user = (await User.findById(session.user.id)
      .select("isBanned banReason bannedAt")
      .lean()) as any;

    if (!user) {
      return NextResponse.json({ isBanned: false });
    }

    return NextResponse.json({
      isBanned: !!user.isBanned,
      banReason: user.banReason ?? null,
      bannedAt: user.bannedAt ?? null,
    });
  } catch (err) {
    console.error("[GET /api/user/ban-status]", err);
    // Fail open — never accidentally show ban overlay due to server error
    return NextResponse.json({ isBanned: false });
  }
}
```

**IMPORTANT:** If the route `GET /api/user/[userId]/ban-status` also exists,
it must check that the `[userId]` in the path matches the session user's ID.
Add this guard at the start of that handler:

```typescript
// In GET /api/user/[userId]/ban-status:
const session = await getServerSession(authOptions);
if (!session)
  return NextResponse.json({ error: "Login required" }, { status: 401 });

// Only allow users to check their OWN ban status via this route
// Admins can check any user's status
if (session.user.role !== "admin" && params.userId !== session.user.id) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

#### Fix — Update BannedOverlay with session storage "seen" flag

**File:** `src/components/BannedOverlay.tsx`

Replace the entire component:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Ban, X, ArrowRight } from 'lucide-react';

interface BanInfo {
  isBanned:  boolean;
  banReason?: string;
  bannedAt?:  string;
}

// Key stored in sessionStorage — cleared when browser tab closes
// Using sessionStorage (not localStorage) means:
//   - Overlay shows once per browser session
//   - If they close the tab and reopen, they see it again (correct behaviour)
//   - Navigating between pages does NOT re-show it (correct behaviour)
const SEEN_KEY = 'campusbuzz_ban_overlay_seen';

export default function BannedOverlay() {
  const [banInfo, setBanInfo]     = useState<BanInfo | null>(null);
  const [dismissed, setDismissed] = useState(true); // Start hidden
  const [visible, setVisible]     = useState(false);

  useEffect(() => {
    // Check if already seen this session — never re-show
    const alreadySeen = sessionStorage.getItem(SEEN_KEY) === 'true';
    if (alreadySeen) return;

    // Always call the session-based endpoint (no userId in URL)
    fetch('/api/user/ban-status')
      .then(r => r.ok ? r.json() : null)
      .then((data: BanInfo | null) => {
        if (data?.isBanned) {
          setBanInfo(data);
          setDismissed(false); // Only show if actually banned
          // Animate in after short delay
          setTimeout(() => setVisible(true), 100);
        }
        // If not banned: dismissed stays true → component renders nothing
      })
      .catch(() => {
        // Network error — fail silently, never show overlay
      });
  }, []); // Empty dependency: runs ONCE per mount, session storage prevents re-show

  const handleDismiss = () => {
    // Mark as seen so it does not reappear this session
    sessionStorage.setItem(SEEN_KEY, 'true');
    setDismissed(true);
  };

  // Nothing to show — not banned, already dismissed, or loading
  if (!banInfo?.isBanned || dismissed) return null;

  return (
    <>
      {/* Full-screen backdrop */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{
          background:      visible ? 'rgba(100,0,0,0.88)' : 'transparent',
          backdropFilter:  visible ? 'blur(8px)' : 'none',
          transition:      'background 0.5s ease, backdrop-filter 0.5s ease',
        }}
      >
        {/* Animated pulse rings — decorative */}
        {visible && [1,2,3].map(i => (
          <div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              width:  `${i * 260}px`,
              height: `${i * 260}px`,
              border: '1px solid rgba(239,68,68,0.15)',
              animation: `ban-pulse ${1.5 + i * 0.3}s ease-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}

        {/* Modal card */}
        <div
          className="relative w-full max-w-md rounded-2xl overflow-hidden"
          style={{
            background:  '#0a0505',
            border:      '1px solid rgba(239,68,68,0.4)',
            boxShadow:   '0 0 80px rgba(239,68,68,0.15)',
            transform:   visible ? 'scale(1)' : 'scale(0.9)',
            opacity:     visible ? 1 : 0,
            transition:  'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
          }}
        >
          {/* Red top bar */}
          <div
            className="h-1.5 w-full"
            style={{
              background: 'linear-gradient(90deg,#dc2626,#7f1d1d,#dc2626)',
              backgroundSize: '200% 100%',
              animation: 'ban-gradient 2s linear infinite',
            }}
          />

          <div className="p-8 text-center">
            {/* Dismiss button — top right */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors
                         hover:bg-white/5"
              style={{ color: '#6b7280' }}
              title="Dismiss — you can still browse events"
            >
              <X size={16} />
            </button>

            {/* Icon */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border:     '2px solid rgba(239,68,68,0.4)',
              }}
            >
              <Ban size={36} style={{ color: '#ef4444' }} />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              Account Restricted
            </h2>

            <p className="text-sm mb-5" style={{ color: '#94a3b8' }}>
              Your account has been restricted from registering for events.
            </p>

            {banInfo.banReason && (
              <div
                className="p-4 rounded-xl mb-5 text-left"
                style={{
                  background: 'rgba(239,68,68,0.06)',
                  border:     '1px solid rgba(239,68,68,0.15)',
                }}
              >
                <p className="text-xs font-semibold mb-1" style={{ color: '#f87171' }}>
                  Reason:
                </p>
                <p className="text-sm" style={{ color: '#fca5a5' }}>
                  {banInfo.banReason}
                </p>
              </div>
            )}

            {banInfo.bannedAt && (
              <p className="text-xs mb-5" style={{ color: '#475569' }}>
                Restricted on {new Date(banInfo.bannedAt).toLocaleDateString('en-NP', { dateStyle: 'medium' })}
              </p>
            )}

            <div
              className="p-3 rounded-xl mb-5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border:     '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <p className="text-xs leading-relaxed" style={{ color: '#64748b' }}>
                If you believe this is a mistake, please visit the admin office
                in person with your student ID card to appeal this decision.
              </p>
            </div>

            <button
              onClick={handleDismiss}
              className="w-full py-3 rounded-xl text-sm font-medium transition-colors"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border:     '1px solid rgba(239,68,68,0.25)',
                color:      '#f87171',
              }}
            >
              <span className="flex items-center justify-center gap-2">
                I understand — Continue browsing
                <ArrowRight size={14} />
              </span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ban-pulse {
          0%   { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes ban-gradient {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
    </>
  );
}
```

#### Verify

```
1. Login as student15@campusbuzz.com (New tier — NOT banned)
2. Go to /my-events, /events — confirm NO red overlay appears
3. Logout

4. Login as student24@campusbuzz.com (Banned student)
5. Confirm red animated overlay appears with ban reason
6. Click "I understand — Continue browsing"
7. Navigate to /events — confirm overlay does NOT reappear
8. Navigate to /my-events — confirm overlay does NOT reappear
9. Close browser tab, reopen, login again as student24
10. Confirm overlay appears ONCE again (sessionStorage cleared on tab close)

11. Login as admin — confirm NO overlay appears (admin check works)
```

---

## GROUP B — UNRELIABLE TIER REGISTRATION BLOCK (CRITICAL ALGORITHM FIX)

### Bug B1 — Unreliable Students Cannot Register

The documentation shows unreliable students are fully blocked from registering.
This creates a catch-22: to improve your score you need to attend events, but
to attend events you need to register. Unreliable students are permanently stuck.

**File:** `src/app/api/register/route.ts`

Find and REMOVE this block entirely:

```typescript
// FIND and DELETE this — do not keep any part of it:
if (user.engagementTier === "unreliable") {
  return NextResponse.json(
    {
      error: "Your account currently has restricted registration access...",
      code: "UNRELIABLE_TIER",
    },
    { status: 403 },
  );
}
```

The consequence for Unreliable tier is the shorter 12-hour confirmation window,
not a full block. The window is set via `TIER_CONFIG.unreliable.confirmationWindowHours`.

After removing the block, verify:

- Unreliable students CAN register
- They get a 12-hour confirmation window (set in run-confirmations route)
- Their score improves when they check in to events they registered for

---

## GROUP C — UI BUGS AND VISUAL FIXES

### Bug C1 — Sold-Out Stamp Positioning

The sold-out stamp may overlap the event image or be invisible against it.

**File:** `src/components/EventCard.tsx`

The card wrapper must have `relative` positioning for the stamp overlay to work:

```typescript
// Card wrapper — ensure this class is present:
<div className="relative rounded-2xl overflow-hidden group ...">

// Stamp overlay — positioned in top-right corner of the IMAGE area
// Only shows when isFull and student is not registered
{isFull && !isRegistered && (
  <div
    className="absolute top-3 right-3 z-10"
    // Semi-transparent so image is still partially visible beneath
  >
    <SoldOutStamp size="sm" />
  </div>
)}
```

If no image, the stamp should still appear in the same position
(it will sit over the dark card background which gives enough contrast).

### Bug C2 — Cancel Button Shown After Confirmation

**File:** `src/app/my-events/page.tsx` (or wherever registrations are displayed)

The cancel registration button must check `confirmed` status:

```typescript
// Show cancel button ONLY when ALL conditions are true:
const canCancel = (
  !registration.confirmed &&          // NOT yet confirmed
  !registration.checkedIn &&          // NOT already checked in
  registration.paymentStatus === 'FREE' &&   // Free events only
  new Date(registration.eventDate) > new Date()  // Event hasn't started
);

{canCancel && (
  // Cancel button JSX
)}

// If confirmed and not checked in: show "Confirmed" indicator instead
{registration.confirmed && !registration.checkedIn && (
  <div className="flex items-center gap-1.5" style={{ color: '#14b8a6' }}>
    <CheckCircle size={12} />
    <span className="text-xs font-medium">Attendance confirmed</span>
  </div>
)}
```

### Bug C3 — Badge Visibility on Event Detail Page

When viewing an individual event (after clicking an EventCard), badges
(category, free/paid, sold-out) may not be visible if positioned over the image.

**File:** `src/app/event/[id]/page.tsx`

Badges must always be positioned BELOW the hero image in the content area,
never overlaid on the image:

```typescript
// Correct structure for event detail page:
<div>
  {/* Hero image */}
  {event.imageUrl && (
    <div className="relative h-64 sm:h-80 overflow-hidden rounded-2xl mb-5">
      <img src={event.imageUrl} alt={event.title}
           className="w-full h-full object-cover" />
    </div>
  )}

  {/* Badge row — always below image, never on top of it */}
  <div className="flex items-center gap-2 flex-wrap mb-4">
    {/* Category badge */}
    <span className="px-3 py-1 rounded-full text-xs font-semibold border
                     bg-teal-500/10 text-teal-300 border-teal-500/20">
      {event.category}
    </span>
    {/* Price badge */}
    {event.feeType === 'free' ? (
      <span className="px-3 py-1 rounded-full text-xs font-semibold border
                       bg-teal-500/10 text-teal-300 border-teal-500/20">
        Free Entry
      </span>
    ) : (
      <span className="px-3 py-1 rounded-full text-xs font-semibold border
                       bg-amber-500/10 text-amber-300 border-amber-500/20">
        Rs. {event.fee?.toLocaleString()}
      </span>
    )}
    {/* Full badge */}
    {isFull && (
      <span className="px-3 py-1 rounded-full text-xs font-semibold border
                       bg-red-500/10 text-red-400 border-red-500/20">
        At Capacity
      </span>
    )}
  </div>

  {/* Event title */}
  <h1 className="text-2xl font-bold text-white mb-3">{event.title}</h1>
  {/* ... rest of content */}
</div>
```

### Bug C4 — Duplicate Eye Icon in Password Fields

**File:** `src/app/globals.css`

Add these rules to hide the browser's built-in password reveal button:

```css
/* Hide browser native password reveal — prevents duplicate eye icon
   Affects: Chrome, Edge, Brave, Safari */
input[type="password"]::-webkit-credentials-auto-fill-button,
input[type="password"]::-webkit-strong-password-auto-fill-button,
input[type="password"]::-webkit-textfield-decoration-container,
input[type="password"]::-ms-reveal,
input[type="password"]::-ms-clear {
  display: none !important;
  visibility: hidden !important;
}
```

### Bug C5 — Waitlist Position Shows Join Order Not Priority Order

**File:** `src/app/api/waitlist/[eventId]/route.ts`
(or wherever waitlist position is returned)

The position must be computed by sorting all entries by priority score,
not by `joinedAt` timestamp:

```typescript
// WRONG — returns join order:
const entries = await Waitlist.find({ eventId, abandonedAt: null })
  .sort({ joinedAt: 1 })
  .lean();
const position = entries.findIndex((e) => e.userId.toString() === userId) + 1;

// CORRECT — returns priority order:
import {
  getSortedWaitlist,
  getWaitlistPosition,
} from "@/lib/algorithms/waitlistManager";

const positionData = await getWaitlistPosition(eventId, userId);
// positionData.position is the real priority rank
// positionData.queueLength is total count
```

If `getSortedWaitlist` is not yet implemented, add it to `waitlistManager.ts`:

```typescript
export async function getSortedWaitlist(eventId: string) {
  const entries = (await Waitlist.find({
    eventId,
    abandonedAt: null,
  }).lean()) as any[];

  // Compute priority score for each entry
  const withScores = await Promise.all(
    entries.map(async (entry) => {
      const score = await computePriorityScore(
        entry.userId.toString(),
        entry.joinedAt,
        entry.wasPromoted ?? false,
      );
      return { ...entry, _priorityScore: score };
    }),
  );

  // Sort ascending — lower score = higher priority = position #1
  return withScores.sort((a, b) => a._priorityScore - b._priorityScore);
}

export async function getWaitlistPosition(eventId: string, userId: string) {
  const sorted = await getSortedWaitlist(eventId);
  const idx = sorted.findIndex((e) => e.userId.toString() === userId);
  if (idx === -1) return null;
  return {
    position: idx + 1,
    queueLength: sorted.length,
  };
}
```

---

## GROUP D — ALGORITHM CORRECTNESS

### D1 — Remove Stored Priority Score from Waitlist

**File:** `src/models/Waitlist.ts`

If the schema has a `priority` field that stores a pre-computed value, remove it.
Priority must always be computed fresh from current tier data:

```typescript
// REMOVE this field if it exists:
// priority: { type: Number }

// The schema should only store:
// userId, eventId, joinedAt, abandonedAt, wasPromoted
```

**File:** Wherever waitlist entries are created:

```typescript
// REMOVE any line that sets priority at creation time:
// priority: computePriorityScore(userId, joinedAt), // WRONG

// Create without priority — it is computed dynamically:
await Waitlist.create({
  eventId,
  userId,
  joinedAt: new Date(),
  abandonedAt: null,
  wasPromoted: false,
  // No priority field
});
```

### D2 — Attendance Rate Must Exclude Cancelled Events

**File:** `src/lib/ml/reliabilityScoring.ts`

In `computeMetrics`, the attendance rate calculation must exclude registrations
where the event was cancelled:

```typescript
// WRONG — cancelled events count against student:
const totalConfirmed = await Registration.countDocuments({
  userId,
  isConfirmed: true,
});

// CORRECT — exclude cancelled event registrations:
const confirmedRegistrations = await Registration.aggregate([
  {
    $match: { userId: new mongoose.Types.ObjectId(userId), isConfirmed: true },
  },
  {
    $lookup: {
      from: "events",
      localField: "eventId",
      foreignField: "_id",
      as: "event",
    },
  },
  { $unwind: "$event" },
  // Exclude cancelled events
  { $match: { "event.cancelledAt": null } },
  { $count: "total" },
]);
const totalConfirmed = confirmedRegistrations[0]?.total ?? 0;

// Same pattern for totalCheckedIn:
const checkedInRegistrations = await Registration.aggregate([
  { $match: { userId: new mongoose.Types.ObjectId(userId), checkedIn: true } },
  {
    $lookup: {
      from: "events",
      localField: "eventId",
      foreignField: "_id",
      as: "event",
    },
  },
  { $unwind: "$event" },
  { $match: { "event.cancelledAt": null } },
  { $count: "total" },
]);
const totalCheckedIn = checkedInRegistrations[0]?.total ?? 0;
```

### D3 — Champion Tier Minimum Attendance Requirement

**File:** `src/lib/ml/reliabilityScoring.ts` and/or `src/lib/constants.ts`

Champion tier should require at least 8 attended events, not just a high score.
A student who attended 3 events at 100% rate must NOT be Champion.

```typescript
import { TIER_CONFIG } from "@/lib/constants";

function classifyTier(metrics: ReliabilityMetrics, anomalyScore: number) {
  const {
    attendanceRate,
    totalAttended,
    waitlistAbandonRate,
    bulkRegistrationScore,
    totalRegistrations,
  } = metrics;

  // New: not enough data
  if (totalRegistrations < 3) return "new";

  // Unreliable: any one of these triggers it
  if (
    attendanceRate < 0.25 ||
    waitlistAbandonRate >= 0.5 ||
    bulkRegistrationScore >= 6 ||
    anomalyScore >= 0.7
  )
    return "unreliable";

  // Champion: ALL conditions must be met
  // totalAttended >= 8 prevents gaming with just 3 events
  const champConfig = TIER_CONFIG.champion;
  if (
    totalAttended >= champConfig.minAttended && // e.g. 8
    attendanceRate >= champConfig.minAttendanceRate && // e.g. 0.70
    waitlistAbandonRate < champConfig.maxWaitlistAbandon && // e.g. 0.20
    anomalyScore < 0.3
  )
    return "champion";

  // Regular: base conditions
  if (totalAttended >= 3 && attendanceRate >= 0.4) return "regular";

  return "new";
}
```

Ensure `TIER_CONFIG.champion.minAttended` is set to `8` in your constants file.

---

## GROUP E — CONSTANTS MUST REFLECT IN UI

### E1 — Tier Benefits Must Read from TIER_CONFIG

Every place the app shows "48 hours" or "2× priority" must read from constants,
not hardcoded strings. This way changing constants automatically updates the UI.

**File:** `src/components/ReliabilityCard.tsx`

```typescript
import { TIER_CONFIG } from '@/lib/constants';

// Helper: format hours for display
function fmtHours(h: number): string {
  if (h < 1/60) return `${Math.round(h * 3600)} seconds`;
  if (h < 1)    return `${Math.round(h * 60)} minutes`;
  if (h === 1)  return `1 hour`;
  return `${h} hours`;
}

// When rendering tier benefits:
const cfg = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];

<p>{fmtHours(cfg.confirmationWindowHours)} to confirm free event spots</p>
<p>
  {cfg.waitlistMultiplier > 0
    ? `${cfg.waitlistMultiplier}× priority bonus on waitlists`
    : 'No waitlist priority bonus yet'
  }
</p>
```

**File:** `src/app/event/[id]/page.tsx`

Tier context below register button must use constants:

```typescript
import { TIER_CONFIG } from '@/lib/constants';
import { fmtHours } from '@/lib/utils'; // or inline the helper

// Tier context shown below register button for free events:
{session && !isRegistered && !isFull && event.feeType === 'free'
 && userTier && (
  <p className={`text-xs text-center mt-2 ${TIER_CONFIG[userTier].color}`}>
    {userTier === 'champion'
      ? `Champion benefit: ${fmtHours(TIER_CONFIG.champion.confirmationWindowHours)} to confirm`
      : `You have ${fmtHours(TIER_CONFIG[userTier as keyof typeof TIER_CONFIG].confirmationWindowHours)} to confirm via email`
    }
  </p>
)}
```

**File:** `src/components/admin/AlgorithmInsights.tsx`

Thresholds shown in the widget must come from constants:

```typescript
import { ML_THRESHOLDS, TIER_CONFIG } from '@/lib/constants';

// Instead of hardcoded "0.65":
<Row label="Flag threshold" value={`${ML_THRESHOLDS.checkin.flagThreshold * 100}%`} />
<Row label="Block threshold" value={`${ML_THRESHOLDS.checkin.blockThreshold * 100}%`} />
<Row label="Champion requires" value={`${TIER_CONFIG.champion.minAttended}+ events`} />
```

### E2 — Improvement Tips Must Use Constants

**File:** `src/app/api/user/reliability/route.ts`

When computing the improvement tip:

```typescript
import { TIER_CONFIG } from "@/lib/constants";

function buildImprovementTip(
  tier: string,
  totalAttended: number,
  attendanceRate: number,
): string {
  const champConfig = TIER_CONFIG.champion;

  if (tier === "champion") {
    return `Maintain ${Math.round(champConfig.minAttendanceRate * 100)}%+ attendance to keep Champion status.`;
  }
  if (tier === "regular") {
    const needed = champConfig.minAttended - totalAttended;
    if (needed > 0) {
      return `Attend ${needed} more event${needed > 1 ? "s" : ""} with ${Math.round(champConfig.minAttendanceRate * 100)}%+ attendance to reach Champion.`;
    }
    return `Maintain your attendance rate to unlock Champion status.`;
  }
  if (tier === "new") {
    return `Attend ${TIER_CONFIG.regular.minAttended} events to unlock your reliability score.`;
  }
  // unreliable
  if (attendanceRate < 0.25) {
    return `Attend your next registered events to raise your ${Math.round(attendanceRate * 100)}% attendance rate above 25%.`;
  }
  return `Attend your registered events consistently to improve your score.`;
}
```

---

## GROUP F — PERFORMANCE AND SECURITY

### F1 — Session Duration Too Long

**File:** `src/lib/auth.ts`

The current session duration is 30 days. This is too long — old sessions
stay valid even after server restarts, password changes, or bans.

Change to 24 hours:

```typescript
import { SESSION_CONFIG } from '@/lib/constants';
// SESSION_CONFIG.MAX_AGE_SECONDS should be 24 * 60 * 60 = 86400

session: {
  strategy: 'jwt',
  maxAge: SESSION_CONFIG.MAX_AGE_SECONDS, // 24 hours
},
jwt: {
  maxAge: SESSION_CONFIG.MAX_AGE_SECONDS,
},
```

Ensure `SESSION_CONFIG.MAX_AGE_SECONDS = 24 * 60 * 60` in your constants file.

### F2 — Add `.lean()` to All Read-Only Queries

Search every GET route handler for Mongoose queries. Any `.find()`,
`.findOne()`, `.findById()` that only reads data (does not call `.save()`)
must end with `.lean()`:

```typescript
// SLOW — creates full Mongoose document objects:
const events = await Event.find({ isActive: true });

// FAST — returns plain JS objects (3-5x faster):
const events = await Event.find({ isActive: true }).lean();
```

### F3 — Use Promise.all for Parallel DB Queries

In any route that makes multiple independent DB queries, run them in parallel:

```typescript
// SLOW (sequential):
const totalEvents = await Event.countDocuments({});
const totalUsers = await User.countDocuments({ role: "student" });
const totalReg = await Registration.countDocuments({});

// FAST (parallel):
const [totalEvents, totalUsers, totalReg] = await Promise.all([
  Event.countDocuments({}),
  User.countDocuments({ role: "student" }),
  Registration.countDocuments({}),
]);
```

Apply this pattern to the admin dashboard stats route and any other route
that currently queries sequentially.

---

## GROUP G — LANDING PAGE IMPROVEMENTS

### G1 — FAQ Section Must Use Constants

**File:** `src/components/FaqSection.tsx` or wherever FAQ is rendered

```typescript
import { FAQ_ITEMS } from '@/lib/constants';
// (FAQ_ITEMS defined in src/lib/constants/appConfig.ts as per previous implementation)

// Replace hardcoded faqs array with:
{FAQ_ITEMS.map((faq, i) => (
  // ... existing accordion JSX using faq.q and faq.a
))}
```

### G2 — Animated Stats Counter

**File:** `src/app/page.tsx` (or landing page)

Stats that show "0" then flash to real values indicate useState with initial 0.
If the landing page is a server component, stats render with real values
immediately (no flash). If it is a client component with useEffect, convert it.

For the animated counting effect, use `AnimatedStat` component:

```typescript
'use client';
import { useEffect, useRef, useState } from 'react';

export default function AnimatedStat({
  target, label
}: { target: string; label: string }) {
  const [display, setDisplay] = useState('0');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const num = parseInt(target.replace(/\D/g,'')) || 0;
    const suffix = target.replace(/\d/g,'');
    if (!num) { setDisplay(target); return; }
    let step = 0;
    const steps = 35;
    const interval = setInterval(() => {
      step++;
      const ease = 1 - Math.pow(1 - step/steps, 3);
      setDisplay(`${Math.round(num * ease)}${suffix}`);
      if (step >= steps) { setDisplay(target); clearInterval(interval); }
    }, 1200/steps);
    return () => clearInterval(interval);
  }, [target]);

  return (
    <div className="text-center">
      <div className="text-4xl font-extrabold text-teal-400">{display}</div>
      <div className="text-xs font-semibold tracking-wider text-teal-700 uppercase mt-1">
        {label}
      </div>
    </div>
  );
}
```

---

## GROUP H — REMAINING CLEANUP

### H1 — Consolidate to Single Constants File

If both `src/lib/ml/constants.ts` and `src/lib/constants.ts` exist,
consolidate. All ML thresholds must come from the main constants file.

```bash
grep -r "from.*lib/ml/constants" src/
# For each result: change import to '@/lib/constants'
# Then delete src/lib/ml/constants.ts
```

### H2 — payment/success Empty Directory

```bash
grep -r "payment/success" src/ --include="*.ts" --include="*.tsx"
```

If no references: delete the empty directory.
If references exist, add a redirect page:

```typescript
// src/app/payment/success/page.tsx
import { redirect } from "next/navigation";
export default function PaymentSuccessRedirect() {
  redirect("/payment/verify");
}
```

### H3 — Flag Reasons Must Be Saved to Registration

**File:** `src/app/api/checkin/route.ts`

After computing the flag reason, it must be saved to the Registration document:

```typescript
import { generateFlagReason } from "@/lib/ml/flagReasoning";

if (flagged || blocked) {
  const flagReason = generateFlagReason(
    features,
    anomalyScore,
    blocked ? "blocked" : "flagged",
    registrationId,
  );

  await Registration.findOneAndUpdate(
    { registrationId },
    { $set: { flagged: true, anomalyScore, flagReason } },
  );
}
```

---

## FINAL VERIFICATION CHECKLIST

```bash
npm run build   # 0 TypeScript errors
npm run lint    # 0 lint errors
npm test        # all pass
node scripts/seed.js
npm run dev
```

### Critical bugs:

- [ ] Login as student19 (Unreliable) → Navigate to /my-events, /events
      → Admin refreshes student19's profile → score has NOT changed
- [ ] Login as student15 (Not banned) → No red overlay appears anywhere
- [ ] Login as student24 (Banned) → Red overlay appears ONCE
- [ ] Navigate between pages as student24 → Overlay does NOT reappear
- [ ] Logout and login again as student24 → Overlay appears again (correct)
- [ ] Login as admin → No overlay appears (admin is never banned)

### Algorithm:

- [ ] Unreliable student can register for events (no 403 block)
- [ ] Unreliable student gets 12h confirmation window
- [ ] Student with 3 events at 100% rate is Regular (NOT Champion)
- [ ] Student with 8+ events at 70%+ rate is Champion
- [ ] Cancelled event registrations excluded from attendance rate
- [ ] Waitlist position shows priority order (Champion beats Unreliable even joining later)

### Constants reflected in UI:

- [ ] Change TIER_CONFIG.champion.confirmationWindowHours in constants
      → ReliabilityCard and event page immediately show new value
- [ ] Change TIER_CONFIG.champion.minAttended in constants
      → Tier classification immediately uses new value
- [ ] Change ML_THRESHOLDS.checkin.flagThreshold
      → Algorithm Insights widget shows new value

### Other fixes:

- [ ] Cancel button hidden when registration.confirmed is true
- [ ] Badges visible below image on event detail page
- [ ] Single eye icon in password fields (no duplicate)
- [ ] Sold-out stamp visible on EventCard without blocking image content
- [ ] FAQ section renders FAQ_ITEMS from constants
