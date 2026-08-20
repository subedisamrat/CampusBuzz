/**
 * Extracts feature vectors from check-in context for Isolation Forest scoring.
 *
 * Each check-in produces an 8-dimensional feature vector:
 *   [hourOfDay, daysSinceReg, totalRegistrations, checkinRate,
 *    minutesRelativeToStart, sameCategoryCount, checkinsPerDayNorm, accountAgeNorm]
 *
 * These features capture temporal patterns, registration behavior, and user history
 * to detect anomalous check-in activity (e.g., QR code sharing, ghost attendance).
 */

import Registration from '@/models/Registration';
import User from '@/models/User';
import mongoose from 'mongoose';

export interface CheckinContext {
  userId: string;
  eventId: string;
  eventCategory: string;
  eventDate: Date;
  registrationCreatedAt: Date;
  checkinTime: Date;
  adminOverride?: boolean;
}

/**
 * Extracts an 8-dimensional feature vector for Isolation Forest anomaly detection.
 * All DB queries run in parallel for minimal latency on the check-in hot path.
 *
 * @param ctx - Check-in context containing user, event, and timing data
 * @returns Array of 8 normalized numeric features
 */
export async function extractFeatures(ctx: CheckinContext): Promise<number[]> {
  if (ctx.adminOverride === true) {
    return [0, 0, 0, 0, 0, 0, 0, 0];
  }

  const {
    userId: userIdStr, eventId, eventCategory,
    eventDate, registrationCreatedAt, checkinTime
  } = ctx;

  const userId = new mongoose.Types.ObjectId(userIdStr);

  // Feature 1: hourOfDay (0–23)
  const hourOfDay = checkinTime.getHours();

  // Feature 2: daysSinceReg (days between registration and check-in)
  const daysSinceReg =
    (checkinTime.getTime() - registrationCreatedAt.getTime()) / 86_400_000;

  // Feature 5: minutesRelativeToStart (negative = early, positive = late)
  const minutesRelativeToStart =
    (checkinTime.getTime() - eventDate.getTime()) / 60_000;

  // Feature 7: checkinsPerDay (normalized 0–1, 5+ per day = max)
  const todayStart = new Date(checkinTime);
  todayStart.setHours(0, 0, 0, 0);

  // Run all DB queries in parallel
  const [totalRegistrations, totalCheckins, sameCategoryEvents, checkinsToday, userDoc] =
    await Promise.all([
      Registration.countDocuments({ userId }),
      Registration.countDocuments({ userId, checkedIn: true }),
      Registration.aggregate([
        { $match: { userId, checkedIn: true } },
        { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
        { $unwind: '$event' },
        { $match: { 'event.category': eventCategory } },
        { $count: 'count' },
      ]),
      Registration.countDocuments({
        userId,
        checkedIn: true,
        checkedInAt: { $gte: todayStart },
      }),
      User.findById(userId).select('createdAt').lean() as any,
    ]);

  // Feature 3: totalRegistrations
  // Feature 4: checkinRate
  const checkinRate = totalRegistrations > 0 ? totalCheckins / totalRegistrations : 0;

  // Feature 6: sameCategoryCount
  const sameCategoryCount = sameCategoryEvents[0]?.count ?? 0;

  // Feature 7: checkinsPerDayNorm
  const checkinsPerDayNorm = Math.min(checkinsToday / 5, 1);

  // Feature 8: accountAgeNorm (normalized 0–1, 1 year = 1.0)
  const accountAgeDays = userDoc?.createdAt
    ? (checkinTime.getTime() - new Date(userDoc.createdAt).getTime()) / 86_400_000
    : 0;
  const accountAgeNorm = Math.min(accountAgeDays / 365, 1);

  return [
    hourOfDay,
    daysSinceReg,
    totalRegistrations,
    checkinRate,
    minutesRelativeToStart,
    sameCategoryCount,
    checkinsPerDayNorm,
    accountAgeNorm,
  ];
}
