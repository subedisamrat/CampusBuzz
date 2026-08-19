import mongoose, { Schema, Document } from 'mongoose';

/**
 * Notification types:
 * - confirm_attendance: Student must confirm before token expires
 * - qr_ready:          QR code generated, ready to use
 * - event_tomorrow:    Registered event is tomorrow
 * - event_soon:        Event starts in < 2 hours
 * - checked_in:        Student successfully checked in
 * - promoted:          Promoted from waitlist
 * - waitlist_position: Active waitlist entry (status, not a one-time event)
 * - notify_me:         Notify-me interest on a paid event
 * - payment_confirmed: Payment completed, QR emailed
 * - banned:            Account has been banned
 * - check_denied:      Check-in was denied by admin
 * - event_cancelled:   Event has been cancelled by admin
 * - ban_lifted:        Account restriction has been removed
 */
export type NotificationType =
  | 'confirm_attendance'
  | 'qr_ready'
  | 'event_tomorrow'
  | 'event_soon'
  | 'checked_in'
  | 'promoted'
  | 'waitlist_position'
  | 'notify_me'
  | 'payment_confirmed'
  | 'banned'
  | 'check_denied'
  | 'event_cancelled'
  | 'ban_lifted'
  | 'tier_override';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  eventId?: mongoose.Types.ObjectId;
  registrationId?: string;
  actionUrl?: string;
  actionLabel?: string;
  /** ISO string — when this notification expires from the feed (auto-cleanup) */
  expiresAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type:           { type: String, required: true },
    title:          { type: String, required: true },
    body:           { type: String, required: true },
    eventId:        { type: Schema.Types.ObjectId, ref: 'Event' },
    registrationId: { type: String },
    actionUrl:      { type: String },
    actionLabel:    { type: String },
    expiresAt:      { type: Date },
    readAt:         { type: Date, default: null },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, type: 1, eventId: 1 }, { unique: false });
// TTL — auto-delete notifications older than 30 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default mongoose.models.Notification ||
  mongoose.model<INotification>('Notification', NotificationSchema);
