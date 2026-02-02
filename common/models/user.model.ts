import { Schema, model, models, type Document, type Model } from 'mongoose';
import type { IUser, UserRole } from '$types/user';

export interface UserDocument extends Omit<IUser, '_id'>, Document {}

const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'operator', 'viewer'] as UserRole[],
      default: 'viewer',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// Indexes
userSchema.index({ email: 1, isActive: 1 });

export const User: Model<UserDocument> = models['User'] || model<UserDocument>('User', userSchema);
