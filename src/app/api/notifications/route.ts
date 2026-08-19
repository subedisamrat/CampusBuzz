import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Registration from '@/models/Registration';
import Waitlist from '@/models/Waitlist';
import EventInterest from '@/models/EventInterest';
import User from '@/models/User';
import Notification from '@/models/Notification';
import type { NotificationType } from '@/models/Notification';
import mongoose from 'mongoose';
import { TIME_UNITS } from '@/lib/constants';
import { getWaitlistPosition, getSortedWaitlist } from '@/lib/algorithms/waitlistManager';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 * Returns all unread + recently-read notifications for the current user.
 *
 * Combines two sources:
 *   1. Persisted notifications (Notification collection) — one-time events
 *      like "you got checked in", "payment confirmed", "promoted from waitlist"
 *   2. Live-computed status notifications — always reflect current DB state:
 *      "confirm attendance", "event tomorrow", "waitlist position", "notify me"
 *
 * This is the single endpoint the bell calls. One round trip.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    await connectDB();
    const userId = session.user.id;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * TIME_UNITS.DAY_MS);
    const userIdObj = new mongoose.Types.ObjectId(userId);

    // ── Fetch all data in parallel ─────────────────────────────────────────────
    const [user, registrations, waitlistEntries, interests, persisted] = await Promise.all([
      User.findById(userId).select('isBanned banReason bannedAt').lean() as any,
      Registration.find({ userId: userIdObj })
        .populate('eventId', 'title date endDate venue feeType')
        .lean() as any[],
      Waitlist.find({ userId: userIdObj, abandonedAt: null })
        .populate('eventId', 'title date venue feeType capacity registeredCount')
        .lean() as any[],
      EventInterest.find({ userId: userIdObj })
        .populate('eventId', 'title date feeAmount registeredCount capacity')
        .lean() as any[],
      Notification.find({
        userId: userIdObj,
        $or: [
          { readAt: null },
          { readAt: { $gte: sevenDaysAgo } },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean() as any[],
    ]);

    // ── Build live notifications ───────────────────────────────────────────────
    const liveNotifs: any[] = [];

    // 5a. Banned account
    if (user?.isBanned) {
      liveNotifs.push({
        _id: 'banned',
        type: 'banned' as NotificationType,
        title: 'Account restricted',
        body: user.banReason || 'Your account has been restricted from registering for events.',
        bannedAt: user.bannedAt,
        actionUrl: '/my-events',
        actionLabel: 'View my events',
        priority: 0,
        isLive: true,
        readAt: null,
        createdAt: user.bannedAt || now,
      });
    }

    for (const reg of registrations) {
      const event = reg.eventId as any;
      if (!event) continue;

      const eventDate = new Date(event.date);
      const eventEnd = event.endDate ? new Date(event.endDate) : new Date(eventDate.getTime() + 2 * TIME_UNITS.HOUR_MS);
      const isPastEvent = eventEnd < now;

      if (isPastEvent) continue; // no notifications for ended events

      const hoursToEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // 5b. Check-in denied
      if (reg.reviewStatus === 'denied') {
        liveNotifs.push({
          _id: `denied-${reg._id}`,
          type: 'check_denied' as NotificationType,
          title: 'Check-in denied',
          body: reg.adminDenyNote || reg.flagReason || `Your entry to ${event.title} was denied. Speak with the event organiser.`,
          eventId: event._id,
          eventTitle: event.title,
          actionUrl: `/events/${event._id}`,
          actionLabel: 'View event',
          priority: 1,
          isLive: true,
          readAt: null,
          createdAt: reg.reviewedAt || reg.updatedAt,
        });
        continue;
      }

      // 5c. Confirm attendance — email sent but not yet confirmed
      if (
        !reg.confirmed &&
        reg.confirmationEmailSent &&
        reg.confirmTokenExpiry &&
        !reg.checkedIn
      ) {
        const expiry = new Date(reg.confirmTokenExpiry);
        const hoursLeft = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursLeft > 0) {
          const isUrgent = hoursLeft < 3;
          liveNotifs.push({
            _id: `confirm-${reg._id}`,
            type: 'confirm_attendance' as NotificationType,
            title: isUrgent ? '⚠️ Confirm now — expiring soon' : 'Confirm your attendance',
            body: isUrgent
              ? `Your spot at ${event.title} expires in ${Math.ceil(hoursLeft)}h. Confirm now or it goes to the next person on the waitlist.`
              : `You need to confirm your spot at ${event.title}. Your confirmation window closes ${Math.ceil(hoursLeft) > 24 ? `in ${Math.ceil(hoursLeft / 24)} day(s)` : `in ${Math.ceil(hoursLeft)}h`}.`,
            eventId: event._id,
            eventTitle: event.title,
            registrationId: reg.registrationId,
            expiresAt: expiry,
            actionUrl: '/my-events',
            actionLabel: 'Confirm attendance',
            priority: isUrgent ? 1 : 2,
            isLive: true,
            isUrgent,
            readAt: null,
            createdAt: reg.confirmationEmailSentAt || reg.createdAt,
          });
        }
      }

      // 5d. QR ready — confirmed but not yet checked in
      if (reg.confirmed && reg.qrCode && !reg.checkedIn) {
        // Event starting soon (< 2h away)
        if (hoursToEvent >= 0 && hoursToEvent < 2) {
          liveNotifs.push({
            _id: `soon-${reg._id}`,
            type: 'event_soon' as NotificationType,
            title: '🚨 Starting soon',
            body: `${event.title} starts in ${Math.round(hoursToEvent * 60)} minutes. Show your QR at the entrance.`,
            eventId: event._id,
            eventTitle: event.title,
            registrationId: reg.registrationId,
            actionUrl: `/my-events/checkin/${reg.registrationId}`,
            actionLabel: 'Open QR ticket',
            priority: 1,
            isLive: true,
            isUrgent: true,
            readAt: null,
            createdAt: now,
          });
        }
        // Event tomorrow
        else if (hoursToEvent >= 2 && hoursToEvent < 26) {
          liveNotifs.push({
            _id: `tomorrow-${reg._id}`,
            type: 'event_tomorrow' as NotificationType,
            title: '📅 Event tomorrow',
            body: `${event.title} is tomorrow. Your QR code is ready.`,
            eventId: event._id,
            eventTitle: event.title,
            registrationId: reg.registrationId,
            actionUrl: `/my-events/checkin/${reg.registrationId}`,
            actionLabel: 'View QR ticket',
            priority: 2,
            isLive: true,
            readAt: null,
            createdAt: now,
          });
        }
      }
    }

    // 5e. Waitlist positions (batched by event)
    const sortedWaitlistCache = new Map<string, Awaited<ReturnType<typeof getSortedWaitlist>>>();
    for (const entry of waitlistEntries) {
      const event = entry.eventId as any;
      if (!event) continue;

      const eventDate = new Date(event.date);
      if (eventDate < now) continue;

      const eventId = event._id.toString();
      if (!sortedWaitlistCache.has(eventId)) {
        sortedWaitlistCache.set(eventId, await getSortedWaitlist(eventId));
      }
      const sorted = sortedWaitlistCache.get(eventId)!;
      const index = sorted.findIndex(e => e.userId === entry.userId.toString());
      if (index === -1) continue;

      const position = index + 1;
      const queueLength = sorted.length;

      liveNotifs.push({
        _id: `waitlist-${entry._id}`,
        type: 'waitlist_position' as NotificationType,
        title: `#${position} on waitlist`,
        body: `${queueLength} student${queueLength !== 1 ? 's' : ''} ahead of you for ${event.title}. You'll be notified if a spot opens.`,
        eventId: event._id,
        eventTitle: event.title,
        position,
        queueLength,
        actionUrl: `/events/${event._id}`,
        actionLabel: 'View event',
        priority: 3,
        isLive: true,
        readAt: null,
        createdAt: entry.joinedAt,
      });
    }

    // 5f. Notify-me (paid events)
    for (const interest of interests) {
      const event = interest.eventId as any;
      if (!event) continue;

      const eventDate = new Date(event.date);
      if (eventDate < now) continue;

      // Only show if event is still full
      if (event.registeredCount < event.capacity) continue;

      liveNotifs.push({
        _id: `notifyme-${interest._id}`,
        type: 'notify_me' as NotificationType,
        title: 'Watching for a spot',
        body: `${event.title} is sold out. You'll be notified the moment spots open.`,
        eventId: event._id,
        eventTitle: event.title,
        feeAmount: event.feeAmount,
        actionUrl: `/events/${event._id}`,
        actionLabel: 'View event',
        priority: 4,
        isLive: true,
        readAt: null,
        createdAt: interest.createdAt,
      });
    }

    // ── Merge persisted + live, deduplicate, sort ─────────────────────────────
    // Build a set of persisted types that are already covered by live notifs
    // to avoid duplicates (e.g. a persisted "promoted" + live "qr_ready" for same event)
    const liveEventIds = new Set(liveNotifs.map(n => String(n.eventId)));

    // Filter persisted: skip types that have a live counterpart for the same event
    const LIVE_COVERS: NotificationType[] = [
      'confirm_attendance', 'event_tomorrow', 'event_soon', 'waitlist_position', 'notify_me',
      'banned', 'check_denied', 'tier_override',
    ];

    const filteredPersisted = persisted.filter((p: any) => {
      if (LIVE_COVERS.includes(p.type) && liveEventIds.has(String(p.eventId))) return false;
      return true;
    });

    // Tag persisted items
    const taggedPersisted = filteredPersisted.map((p: any) => ({
      ...p,
      _id: String(p._id),
      isLive: false,
      priority: p.readAt ? 99 : 2,
    }));

    const all = [...liveNotifs, ...taggedPersisted];

    // Sort: unread first, then by priority asc, then by createdAt desc
    all.sort((a, b) => {
      const aRead = !!a.readAt;
      const bRead = !!b.readAt;
      if (aRead !== bRead) return aRead ? 1 : -1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const unreadCount = all.filter(n => !n.readAt).length;

    return NextResponse.json({ notifications: all, unreadCount });
  } catch (err) {
    console.error('[GET /api/notifications]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
