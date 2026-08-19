import Registration from '@/models/Registration';
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

export async function extractFeatures(ctx: CheckinContext): Promise<number[]> {
  if (ctx.adminOverride === true) {
    return [0, 0, 0, 0, 0, 0, 0, 0];
  }

  const {
    userId: userIdStr, eventId, eventCategory,
    eventDate, registrationCreatedAt, checkinTime
  } = ctx;

  // Cast to ObjectId so Mongoose queries match correctly
  const userId = new mongoose.Types.ObjectId(userIdStr);

  // Feature 1: hourOfDay
  const hourOfDay = checkinTime.getHours();

  // Feature 2: daysSinceReg
  const daysSinceReg =
    (checkinTime.getTime() - registrationCreatedAt.getTime()) / 86_400_000;

  // Feature 3: totalRegistrations
  const totalRegistrations = await Registration.countDocuments({ userId });

  // Feature 4: checkinRate
  const totalCheckins = await Registration.countDocuments({ userId, checkedIn: true });
  const checkinRate = totalRegistrations > 0 ? totalCheckins / totalRegistrations : 0;

  // Feature 5: minutesRelativeToStart
  const minutesRelativeToStart =
    (checkinTime.getTime() - eventDate.getTime()) / 60_000;

  // Feature 6: sameCategoryCount
  const sameCategoryEvents = await Registration.aggregate([
    { $match: { userId, checkedIn: true } },
    { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
    { $unwind: '$event' },
    { $match: { 'event.category': eventCategory } },
    { $count: 'count' },
  ]);
  const sameCategoryCount = sameCategoryEvents[0]?.count ?? 0;

  // Feature 7: checkinsPerDay (normalized 0–1, 5+ per day = max)
  const todayStart = new Date(checkinTime);
  todayStart.setHours(0, 0, 0, 0);
  const checkinsToday = await Registration.countDocuments({
    userId,
    checkedIn: true,
    checkedInAt: { $gte: todayStart },
  });
  const checkinsPerDayNorm = Math.min(checkinsToday / 5, 1);

  // Feature 8: accountAgeDays (normalized 0–1, 1 year = 1.0)
  // We need to look up the user's createdAt
  const User = (await import('@/models/User')).default;
  const userDoc = await User.findById(userId).select('createdAt').lean() as any;
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
