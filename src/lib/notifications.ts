import connectDB from '@/lib/mongodb';
import Notification from '@/models/Notification';
import type { NotificationType } from '@/models/Notification';

interface PushOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  eventId?: string;
  registrationId?: string;
  actionUrl?: string;
  actionLabel?: string;
  /** Hours until this notification auto-expires. Default: 72h */
  ttlHours?: number;
}

/**
 * Push a one-time notification to a user's feed.
 * De-duplicates by userId + type + eventId — won't create a second
 * identical notification if one unread already exists.
 * Always fire-and-forget: void pushNotification(...).catch(...)
 */
export async function pushNotification(opts: PushOptions): Promise<void> {
  await connectDB();

  const expiresAt = new Date(
    Date.now() + (opts.ttlHours ?? 72) * 60 * 60 * 1000
  );

  // Dedup: if an unread notification of the same type+event exists, skip
  const exists = opts.eventId
    ? await Notification.findOne({
        userId: opts.userId,
        type: opts.type,
        eventId: opts.eventId,
        readAt: null,
      }).lean()
    : null;

  if (exists) return;

  await Notification.create({
    userId: opts.userId,
    type: opts.type,
    title: opts.title,
    body: opts.body,
    eventId: opts.eventId,
    registrationId: opts.registrationId,
    actionUrl: opts.actionUrl,
    actionLabel: opts.actionLabel,
    expiresAt,
    readAt: null,
  });
}
