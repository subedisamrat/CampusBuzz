import mongoose from 'mongoose';
import Registration from '@/models/Registration';
import Waitlist from '@/models/Waitlist';
import Event from '@/models/Event';
import User from '@/models/User';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { sendPromotionEmail } from '@/lib/email';
import { WAITLIST_CONFIG, TIER_CONFIG, CONFIRMATION_CONFIG } from '@/lib/constants';
import { updateStudentReliability } from '@/lib/ml/reliabilityScoring';
import { logActivity } from '@/lib/activityLog';

function computeScoreInline(
  userId: string,
  joinedAt: Date,
  wasPromotedBefore: boolean,
  engagementTier: string,
  attendanceCount: number
): number {
  const tier = (engagementTier ?? 'new') as keyof typeof TIER_CONFIG;
  const tierConfig = TIER_CONFIG[tier];

  let score = joinedAt.getTime();
  score -= tierConfig.tierBasePriorityHours * WAITLIST_CONFIG.HOUR_DISCOUNT_MS;
  score -= attendanceCount * WAITLIST_CONFIG.HOUR_DISCOUNT_MS * tierConfig.waitlistMultiplier;
  score += tierConfig.waitlistPenaltyHours * WAITLIST_CONFIG.HOUR_DISCOUNT_MS;
  if (wasPromotedBefore) {
    score += CONFIRMATION_CONFIG.rejoinPenaltyHours * WAITLIST_CONFIG.HOUR_DISCOUNT_MS;
  }
  return score;
}

export async function computePriorityScore(
  userId: string,
  joinedAt: Date,
  wasPromotedBefore: boolean = false
): Promise<number> {
  const user = await User.findById(userId)
    .select('engagementTier')
    .lean() as any;
  const tier = (user?.engagementTier ?? 'new') as keyof typeof TIER_CONFIG;

  const attendanceCount = await Registration.countDocuments({
    userId,
    checkedIn: true,
  });

  return computeScoreInline(userId, joinedAt, wasPromotedBefore, tier, attendanceCount);
}

export async function getSortedWaitlist(eventId: string): Promise<Array<{
  userId: string;
  joinedAt: Date;
  priorityScore: number;
  wasPromoted: boolean;
}>> {
  const entries = await Waitlist.find({
    eventId,
    abandonedAt: null,
  }).lean() as any[];

  if (entries.length === 0) return [];

  const userIds = entries.map((e: any) => e.userId.toString());

  const users = await User.find({ _id: { $in: userIds } })
    .select('engagementTier')
    .lean() as any[];
  const tierMap = new Map<string, string>(
    users.map((u: any) => [u._id.toString(), u.engagementTier ?? 'new'])
  );

  const counts = await Registration.aggregate([
    { $match: { userId: { $in: userIds.map((id: string) => new mongoose.Types.ObjectId(id)) }, checkedIn: true } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map<string, number>(
    (counts as Array<{ _id: string; count: number }>).map((c) => [c._id.toString(), c.count])
  );

  const withScores = entries.map((entry: any) => {
    const uid = entry.userId.toString();
    return {
      userId: uid,
      joinedAt: entry.joinedAt,
      wasPromoted: entry.wasPromoted ?? false,
      priorityScore: computeScoreInline(
        uid,
        entry.joinedAt,
        entry.wasPromoted ?? false,
        tierMap.get(uid) ?? 'new',
        countMap.get(uid) ?? 0
      ),
    };
  });

  return withScores.sort((a, b) => a.priorityScore - b.priorityScore);
}

export async function getWaitlistPosition(
  eventId: string,
  userId: string
): Promise<{ position: number; queueLength: number; priorityScore: number } | null> {
  const sorted = await getSortedWaitlist(eventId);
  const queueLength = sorted.length;
  const index = sorted.findIndex(e => e.userId === userId);

  if (index === -1) return null;

  return {
    position: index + 1,
    queueLength,
    priorityScore: sorted[index].priorityScore,
  };
}

export async function promoteTopWaitlistUser(eventId: string): Promise<void> {
  const sorted = await getSortedWaitlist(eventId);
  if (sorted.length === 0) return;

  const topEntry = sorted[0];
  const userId = topEntry.userId;

  const registrationId = `CP-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  const qrData = JSON.stringify({ registrationId, eventId, userId });
  const qrCode = await QRCode.toDataURL(qrData, {
    width: 300, margin: 2, errorCorrectionLevel: 'H',
  });

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    await Registration.findOneAndUpdate(
      { userId, eventId },
      {
        $set: {
          userId,
          eventId,
          registrationId,
          qrCode,
          confirmed: true,
          confirmationEmailSent: true,
          promotedFromWaitlist: true,
          paymentStatus: 'FREE',
          amountPaid: 0,
        },
      },
      { upsert: true, new: true, session: dbSession }
    );

    await Event.findByIdAndUpdate(
      eventId,
      { $inc: { registeredCount: 1 } },
      { session: dbSession }
    );

    await Waitlist.findOneAndUpdate(
      { eventId, userId, abandonedAt: null },
      { $set: { wasPromoted: true, abandonedAt: new Date() } },
      { session: dbSession }
    );

    await dbSession.commitTransaction();
  } catch (err) {
    await dbSession.abortTransaction();
    throw err;
  } finally {
    dbSession.endSession();
  }

  const event = await Event.findById(eventId).select('title date venue').lean() as any;
  const user = await User.findById(userId).select('email name').lean() as any;

  if (user && event) {
    void sendPromotionEmail({
      to: user.email,
      name: user.name,
      eventName: event.title,
      eventDate: new Date(event.date).toLocaleDateString('en-NP', { dateStyle: 'full' }),
      eventVenue: event.venue,
      qrCodeDataUrl: qrCode,
      registrationId,
    }).catch(err => console.error('[Waitlist] Promotion email failed:', err));
  }

  // Log activity
  void logActivity({
    userId,
    action: 'waitlist_promotion',
    eventId,
    eventTitle: event?.title ?? '',
    details: `Promoted from waitlist for ${event?.title ?? 'event'}`,
  }).catch(err => console.error(err));

  void updateStudentReliability(userId).catch(err =>
    console.error('[Reliability] Post-promotion update failed:', err)
  );
}

export async function promoteForCapacityIncrease(
  eventId: string,
  newCapacity: number
): Promise<number> {
  const event = await Event.findById(eventId).lean() as any;
  if (!event) return 0;

  const spotsAvailable = newCapacity - event.registeredCount;
  if (spotsAvailable <= 0) return 0;

  let promoted = 0;
  for (let i = 0; i < spotsAvailable; i++) {
    const sorted = await getSortedWaitlist(eventId);
    if (sorted.length === 0) break;
    await promoteTopWaitlistUser(eventId);
    promoted++;
  }

  return promoted;
}
