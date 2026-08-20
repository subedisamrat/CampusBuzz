import mongoose, { Document, Schema } from 'mongoose';

export interface IWaitlist extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  joinedAt: Date;
  abandonedAt: Date | null;
  wasPromoted: boolean;
  promotedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const WaitlistSchema = new Schema<IWaitlist>({
  eventId:       { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
  joinedAt:      { type: Date, required: true, default: Date.now },
  abandonedAt:   { type: Date, default: null },
  wasPromoted:   { type: Boolean, default: false },
  promotedAt:    { type: Date, default: null },
}, { timestamps: true });

WaitlistSchema.index({ eventId: 1, userId: 1 }, { unique: true, partialFilterExpression: { abandonedAt: null } });

export default mongoose.models.Waitlist ||
  mongoose.model<IWaitlist>('Waitlist', WaitlistSchema);
