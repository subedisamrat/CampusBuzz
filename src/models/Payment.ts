import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  registrationId?: mongoose.Types.ObjectId;
  amount: number;
  provider: 'esewa' | 'khalti';
  transactionId?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'refund_pending';
  purchaseOrderId?: string;
  purchaseOrderName: string;
  metadata?: Record<string, unknown>;
  refundedAt?: Date;
  refundedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    registrationId: { type: Schema.Types.ObjectId, ref: 'Registration' },
    amount: { type: Number, required: true },
    provider: { type: String, enum: ['esewa', 'khalti'], required: true },
    transactionId: { type: String },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded', 'refund_pending'],
      default: 'pending',
    },
    purchaseOrderId: { type: String },
    purchaseOrderName: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    refundedAt: { type: Date },
    refundedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

PaymentSchema.index({ userId: 1, eventId: 1 });
PaymentSchema.index({ transactionId: 1 }, { unique: true, sparse: true });
PaymentSchema.index({ purchaseOrderId: 1 }, { unique: true, sparse: true });
PaymentSchema.index({ status: 1 });

export default mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);
