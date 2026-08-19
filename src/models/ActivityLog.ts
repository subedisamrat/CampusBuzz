import mongoose, { Schema, Document } from 'mongoose';

export interface IActivityLog extends Document {
  userId: mongoose.Types.ObjectId;
  action: 'register' | 'checkin' | 'cancel' | 'waitlist_join' | 'waitlist_leave' | 'waitlist_promotion';
  eventId?: mongoose.Types.ObjectId;
  eventTitle?: string;
  details?: string;
  algorithmTriggers?: string[];
  tier?: string;
  score?: number;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action:   { type: String, enum: ['register', 'checkin', 'cancel', 'waitlist_join', 'waitlist_leave', 'waitlist_promotion'], required: true },
    eventId:  { type: Schema.Types.ObjectId, ref: 'Event', default: null },
    eventTitle: { type: String, default: '' },
    details:  { type: String, default: '' },
    algorithmTriggers: [{ type: String }],
    tier:     { type: String, default: '' },
    score:    { type: Number, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ActivityLogSchema.index({ userId: 1, createdAt: -1 });
ActivityLogSchema.index({ userId: 1, action: 1 });

export default mongoose.models.ActivityLog || mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
