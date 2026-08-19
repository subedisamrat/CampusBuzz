import mongoose, { Schema, Document } from 'mongoose';

export interface IRegistration extends Document {
  userId: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  registrationId: string;
  qrCode: string;
  checkedIn: boolean;
  checkedInAt?: Date;
  anomalyScore?: number;
  flagged: boolean;
  flagReason?: string;
  adminOverride: boolean;
  paymentId?: mongoose.Types.ObjectId;
  confirmed: boolean;
  confirmToken?: string;
  confirmationEmailSent: boolean;
  confirmationEmailSentAt?: Date;
  confirmedAt?: Date;
  confirmTokenExpiry?: Date;
  cancelledAt?: Date;
  promotedFromWaitlist: boolean;
  isLastMinute: boolean;
  reviewStatus: 'pending' | 'approved' | 'denied';
  adminNote?: string;
  adminDenyNote?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RegistrationSchema = new Schema<IRegistration>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    registrationId: { type: String, required: true, unique: true },
    qrCode: { type: String, default: '' },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date },
    anomalyScore: { type: Number },
    flagged: { type: Boolean, default: false },
    flagReason: { type: String, default: null },
    adminOverride: { type: Boolean, default: false },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    confirmed: { type: Boolean, default: false },
    confirmToken: { type: String },
    confirmationEmailSent: { type: Boolean, default: false },
    confirmationEmailSentAt: { type: Date },
    confirmedAt: { type: Date },
    confirmTokenExpiry: { type: Date },
    cancelledAt: { type: Date },
    promotedFromWaitlist: { type: Boolean, default: false },
    isLastMinute: { type: Boolean, default: false },
    reviewStatus: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
    adminNote: { type: String },
    adminDenyNote: { type: String, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate registrations
RegistrationSchema.index({ userId: 1, eventId: 1 }, { unique: true });
RegistrationSchema.index({ eventId: 1, checkedIn: 1 });
RegistrationSchema.index({ flagged: 1, reviewedAt: 1 });

RegistrationSchema.index({ anomalyScore: 1 });

export default mongoose.models.Registration ||
  mongoose.model<IRegistration>('Registration', RegistrationSchema);
