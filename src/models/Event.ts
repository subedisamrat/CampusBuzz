import mongoose, { Schema, Document } from 'mongoose';
import { EVENT_CATEGORIES } from '@/lib/constants';

export interface IEvent extends Document {
  title: string;
  description: string;
  category: typeof EVENT_CATEGORIES[number];
  date: Date;
  endDate: Date;
  venue: string;
  capacity: number;
  registeredCount: number;
  imageUrl: string;
  organizer: string;
  tags: string[];
  isActive: boolean;
  feeType: 'free' | 'paid';
  feeAmount: number;
  registrationDeadline?: Date;
  createdBy: mongoose.Types.ObjectId;
  isCancelled: boolean;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: EVENT_CATEGORIES,
      default: 'Other',
    },
    date: { type: Date, required: true },
    endDate: { type: Date, required: true },
    venue: { type: String, required: true },
    capacity: { type: Number, required: true, default: 100 },
    registeredCount: { type: Number, default: 0 },
    imageUrl: { type: String, default: '' },
    organizer: { type: String, required: true },
    tags: [{ type: String }],
    isActive: { type: Boolean, default: true },
    feeType: { type: String, enum: ['free', 'paid'], default: 'free' },
    feeAmount: { type: Number, default: 0 },
    registrationDeadline: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isCancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date },
    cancelReason: { type: String },
  },
  { timestamps: true }
);

EventSchema.index({ isActive: 1, date: 1 });
EventSchema.index({ isCancelled: 1 });
EventSchema.index({ createdBy: 1 });
EventSchema.index({ registeredCount: -1 });
EventSchema.index({ category: 1, date: 1 });

EventSchema.pre('save', function (next) {
  if (this.endDate <= this.date) {
    next(new Error('endDate must be after date'));
  } else {
    next();
  }
});

export default mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema);
