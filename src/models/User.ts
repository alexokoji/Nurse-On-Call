import mongoose, { Schema, model, models, type Model, type Document, type Types } from 'mongoose';
import { USER_ROLES, USER_STATUSES, type UserRole, type UserStatus } from '@/types';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  /** bcrypt hash. Never selected by default — queries must opt in. */
  password: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt?: Date | null;
  lastLoginAt?: Date | null;
  /** Consecutive failed logins; reset on success. Drives lockout. */
  failedLoginAttempts: number;
  lockedUntil?: Date | null;
  passwordResetToken?: string | null;
  passwordResetExpires?: Date | null;
  emailVerificationToken?: string | null;
  /** Invalidates issued sessions when bumped (password change, forced logout). */
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    avatar: { type: String },
    role: { type: String, enum: USER_ROLES, required: true, default: 'patient', index: true },
    status: { type: String, enum: USER_STATUSES, required: true, default: 'active', index: true },
    emailVerifiedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    passwordResetToken: { type: String, default: null, select: false, index: true },
    passwordResetExpires: { type: Date, default: null, select: false },
    emailVerificationToken: { type: String, default: null, select: false },
    sessionVersion: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        // Defence in depth: secrets must never reach a serialised payload.
        delete ret.password;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.emailVerificationToken;
        return ret;
      },
    },
  },
);

UserSchema.index({ name: 'text', email: 'text' });
UserSchema.index({ role: 1, status: 1, createdAt: -1 });

export const User: Model<IUser> =
  (models.User as Model<IUser>) || model<IUser>('User', UserSchema);

export default User;

// Keep a reference so bundlers do not tree-shake mongoose out of server builds.
export const _mongoose = mongoose;
