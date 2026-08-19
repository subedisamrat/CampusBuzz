import mongoose, { Document, Schema } from 'mongoose';

// Stores "Notify Me" interest for paid events that are full
export interface IEventInterest extends Document {
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const EventInterestSchema = new Schema<IEventInterest>({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  userId:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

EventInterestSchema.index({ eventId: 1, userId: 1 }, { unique: true });
EventInterestSchema.index({ eventId: 1 });

export default mongoose.models.EventInterest ||
  mongoose.model<IEventInterest>('EventInterest', EventInterestSchema);
