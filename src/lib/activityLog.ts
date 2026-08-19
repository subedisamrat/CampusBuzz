import connectDB from '@/lib/mongodb';
import ActivityLog, { IActivityLog } from '@/models/ActivityLog';
import User from '@/models/User';

type Action = 'register' | 'checkin' | 'cancel' | 'waitlist_join' | 'waitlist_leave' | 'waitlist_promotion';

interface LogInput {
  userId: string;
  action: Action;
  eventId?: string;
  eventTitle?: string;
  details?: string;
  algorithmTriggers?: string[];
  tier?: string;
  score?: number;
}

export async function logActivity(input: LogInput): Promise<void> {
  try {
    await connectDB();

    let tier = input.tier;
    let score = input.score;

    if ((!tier || score === undefined) && input.userId) {
      const user = await User.findById(input.userId).select('engagementTier reliabilityScore').lean() as any;
      if (!tier && user) tier = user.engagementTier ?? '';
      if (score === undefined && user) score = user.reliabilityScore ?? undefined;
    }

    await ActivityLog.create({
      userId: input.userId,
      action: input.action,
      eventId: input.eventId || undefined,
      eventTitle: input.eventTitle || '',
      details: input.details || '',
      algorithmTriggers: input.algorithmTriggers || [],
      tier: tier || '',
      score: score ?? null,
    });
  } catch (err) {
    console.warn('[ActivityLog] Failed to log:', err);
  }
}

export async function getActivityLog(
  userId: string,
  limit: number = 20,
  cursor?: string
): Promise<{ entries: any[]; nextCursor: string | null; hasMore: boolean }> {
  await connectDB();

  const query: any = { userId };
  if (cursor) {
    query._id = { $lt: cursor };
  }

  const entries = await ActivityLog.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean() as any[];

  const hasMore = entries.length > limit;
  const items = hasMore ? entries.slice(0, limit) : entries;
  const nextCursor = hasMore ? items[items.length - 1]._id.toString() : null;

  return {
    entries: items.map(e => ({
      _id: e._id.toString(),
      userId: e.userId.toString(),
      action: e.action,
      eventId: e.eventId?.toString() ?? null,
      eventTitle: e.eventTitle ?? '',
      details: e.details ?? '',
      algorithmTriggers: e.algorithmTriggers ?? [],
      tier: e.tier ?? '',
      score: e.score ?? null,
      createdAt: e.createdAt,
    })),
    nextCursor,
    hasMore,
  };
}
