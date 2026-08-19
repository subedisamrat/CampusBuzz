import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'student' | 'admin';
  college: string;
  engagementTier: 'champion' | 'regular' | 'new' | 'unreliable';
  reliabilityScore: number | null;
  scoreHistory: Array<{
    score: number;
    tier: string;
    reason: string;
    changedAt: Date;
  }>;
  isBanned: boolean;
  banReason: string | null;
  bannedAt: Date | null;
  bannedBy: mongoose.Types.ObjectId | null;
  bannedNote: string | null;
  adminOverriddenTier: boolean;
  adminOverriddenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ScoreHistorySchema = new Schema({
  score:     { type: Number, required: true },
  tier:      { type: String, required: true },
  reason:    { type: String, required: true },
  changedAt: { type: Date, default: Date.now },
}, { _id: false });

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    college: { type: String, default: '' },
    engagementTier: {
      type: String,
      enum: ['champion', 'regular', 'new', 'unreliable'],
      default: 'new',
    },
    reliabilityScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    scoreHistory: [ScoreHistorySchema],
    isBanned:    { type: Boolean, default: false },
    banReason:   { type: String, default: null },
    bannedAt:    { type: Date, default: null },
    bannedBy:    { type: Schema.Types.ObjectId, ref: 'User', default: null },
    bannedNote:  { type: String, default: null },
    adminOverriddenTier: { type: Boolean, default: false },
    adminOverriddenAt:   { type: Date, default: null },
  },
  { timestamps: true }
);

UserSchema.index({ engagementTier: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isBanned: 1 });

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
