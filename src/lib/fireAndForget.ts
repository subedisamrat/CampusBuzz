/**
 * Fire-and-forget helpers for activity logging and push notifications.
 * Eliminates the repeated `void import(...).then(...)` pattern across API routes.
 */

import type { NotificationType } from '@/models/Notification';

type ActivityAction = 'register' | 'checkin' | 'cancel' | 'waitlist_join' | 'waitlist_leave' | 'waitlist_promotion';

export interface ActivityLogInput {
  userId: string;
  action: ActivityAction;
  eventId?: string;
  eventTitle?: string;
  details?: string;
  algorithmTriggers?: string[];
}

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  eventId?: string;
  registrationId?: string;
  actionUrl?: string;
  actionLabel?: string;
  ttlHours?: number;
}

/**
 * Logs an activity event in the background. Never blocks the caller.
 */
export function logActivityFireAndForget(input: ActivityLogInput): void {
  void import('@/lib/activityLog').then(({ logActivity }) => {
    logActivity(input).catch(err => console.error('[ActivityLog]', err));
  }).catch(err => console.error('[ActivityLog] Import failed:', err));
}

/**
 * Pushes an in-app notification in the background. Never blocks the caller.
 */
export function pushNotificationFireAndForget(input: NotificationInput): void {
  void import('@/lib/notifications').then(({ pushNotification }) => {
    pushNotification(input).catch(err => console.error('[Notification]', err));
  }).catch(err => console.error('[Notification] Import failed:', err));
}
