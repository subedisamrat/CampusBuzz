// src/lib/confirmations.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared utility for sending attendance confirmation emails.
// Used by:
//   - src/app/api/admin/run-confirmations/route.ts  (manual admin trigger)
//   - src/lib/reminders.ts  (auto-trigger 3 days before event)
//
// This eliminates the HTTP self-call anti-pattern — reminders.ts used to POST
// to the API route from within the server, which is fragile and environment-
// dependent. Direct import is faster and works in all environments.
// ─────────────────────────────────────────────────────────────────────────────

import connectDB from '@/lib/mongodb';
import Registration from '@/models/Registration';
import Event from '@/models/Event';
import User from '@/models/User';
import { sendAttendanceConfirmation } from '@/lib/email';
import { CONFIRMATION_CONFIG, TIER_CONFIG } from '@/lib/constants';
import crypto from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SendConfirmationsResult {
  sent:          number;
  failed:        number;
  eventTitle:    string;
  eventsProcessed: number;
}

interface SendConfirmationsOptions {
  /** If true, send even if daysUntilEvent > manualTriggerMaxDays */
  force?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Computes the confirmation token expiry for a given student tier.
 * Caps at (eventDate - minHoursBeforeEvent) so the link is always valid
 * before the event starts. If the raw expiry already passes that cap,
 * uses a minimum of 30 minutes so students still get a chance to confirm.
 */
function computeConfirmExpiry(tier: string, eventDate: Date): Date {
  const tierConfig =
    TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.new;

  const windowMs   = tierConfig.confirmationWindowHours * 60 * 60 * 1000;
  const rawExpiry  = new Date(Date.now() + windowMs);
  const latestAllowed = new Date(
    eventDate.getTime() -
    CONFIRMATION_CONFIG.minHoursBeforeEvent * 60 * 60 * 1000
  );

  if (rawExpiry > latestAllowed) {
    const minExpiry = new Date(Date.now() + 30 * 60 * 1000);
    return latestAllowed > minExpiry ? latestAllowed : minExpiry;
  }

  return rawExpiry;
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Send attendance-confirmation emails for one event (or all upcoming events
 * when `eventId` is omitted).
 *
 * Each registration that has `confirmed: false` and
 * `confirmationEmailSent: false` receives a unique token link.
 *
 * @param eventId  MongoDB ObjectId string. Omit to process all upcoming events.
 * @param options  { force: boolean } — bypass the daysUntilEvent guard.
 */
export async function sendConfirmationsForEvent(
  eventId?: string,
  options: SendConfirmationsOptions = {}
): Promise<SendConfirmationsResult> {
  const { force = false } = options;

  await connectDB();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const now    = new Date();

  // ── Collect events to process ────────────────────────────────────────────
  let eventsToProcess: any[] = [];

  if (eventId) {
    const event = await Event.findById(eventId).lean() as any;
    if (!event) throw new Error(`Event not found: ${eventId}`);
    eventsToProcess = [event];
  } else {
    eventsToProcess = await Event.find({
      isActive:    true,
      isCancelled: { $ne: true },
      date:        { $gte: now },
    }).select('title date venue isActive isCancelled').lean() as any[];
  }

  let totalSent        = 0;
  let totalFailed      = 0;
  let processedCount   = 0;
  let lastEventTitle   = '';

  for (const event of eventsToProcess) {
    const eventDate      = new Date(event.date);
    const daysUntilEvent =
      (eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);

    // Skip events too far away unless forced
    if (daysUntilEvent > CONFIRMATION_CONFIG.manualTriggerMaxDays && !force) {
      continue;
    }
    // Skip events that have already passed
    if (eventDate < now) continue;

    const registrations = await Registration.find({
      eventId:                event._id,
      confirmed:              false,
      confirmationEmailSent:  false,
    }).lean() as any[];

    if (registrations.length === 0) continue;

    let eventSent   = 0;
    let eventFailed = 0;

    for (const reg of registrations) {
      try {
        const user = await User.findById(reg.userId)
          .select('email name engagementTier')
          .lean() as any;

        if (!user) continue;

        const tier       = user.engagementTier ?? 'new';
        const tierConfig =
          TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.new;
        const token      = reg.confirmToken ?? crypto.randomBytes(32).toString('hex');
        const expiry     = computeConfirmExpiry(tier, eventDate);
        const confirmUrl = `${appUrl}/api/confirm-attendance?token=${token}`;

        await Registration.findByIdAndUpdate(reg._id, {
          confirmToken:          token,
          confirmTokenExpiry:    expiry,
          confirmationEmailSent: true,
        });

        await sendAttendanceConfirmation({
          to:                  user.email,
          name:                user.name,
          eventName:           event.title,
          eventDate:           eventDate.toLocaleDateString('en-NP', { dateStyle: 'full' }),
          eventVenue:          event.venue,
          confirmUrl,
          confirmWindowHours:  tierConfig.confirmationWindowHours,
        });

        eventSent++;
      } catch (emailErr) {
        console.error('[Confirmations] Email failed for reg', reg._id, emailErr);
        eventFailed++;
      }
    }

    totalSent      += eventSent;
    totalFailed    += eventFailed;
    lastEventTitle  = event.title;
    processedCount++;
  }

  return {
    sent:            totalSent,
    failed:          totalFailed,
    eventTitle:      lastEventTitle,
    eventsProcessed: processedCount,
  };
}
