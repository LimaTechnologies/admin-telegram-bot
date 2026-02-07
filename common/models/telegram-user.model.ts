import { Schema, model, models, Model } from 'mongoose';
import type { ITelegramUser } from '$types/purchase';

const telegramUserSchema = new Schema<ITelegramUser>(
  {
    telegramId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      trim: true,
      lowercase: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    languageCode: String,

    // Stats
    totalPurchases: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },

    // Preferences
    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
telegramUserSchema.index({ username: 1 });
telegramUserSchema.index({ isBlocked: 1 });

export const TelegramUserModel: Model<ITelegramUser> =
  models['TelegramUser'] || model<ITelegramUser>('TelegramUser', telegramUserSchema);
