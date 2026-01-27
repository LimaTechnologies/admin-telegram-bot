import { Schema, model, models, type Document, type Model } from 'mongoose';
import type { ITelegramGroup, GroupSettings, GroupStats, BestPostingHours } from '$types/telegram-group';

export interface TelegramGroupDocument extends Omit<ITelegramGroup, '_id'>, Document {}

const groupSettingsSchema = new Schema<GroupSettings>(
  {
    maxAdsPerDay: {
      type: Number,
      default: 10,
    },
    cooldownMinutes: {
      type: Number,
      default: 60,
    },
    allowedAdTypes: {
      type: String,
      enum: ['onlyfans', 'casino', 'both'],
      default: 'both',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    requiresApproval: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const groupStatsSchema = new Schema<GroupStats>(
  {
    memberCount: {
      type: Number,
      default: 0,
    },
    totalPosts: {
      type: Number,
      default: 0,
    },
    totalViews: {
      type: Number,
      default: 0,
    },
    avgEngagement: {
      type: Number,
      default: 0,
    },
    lastPostAt: {
      type: Date,
    },
  },
  { _id: false }
);

const bestPostingHoursSchema = new Schema<BestPostingHours>(
  {
    hour: {
      type: Number,
      required: true,
    },
    engagement: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const telegramGroupSchema = new Schema<TelegramGroupDocument>(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      index: true,
    },
    type: {
      type: String,
      enum: ['public', 'private', 'supergroup', 'channel'],
      default: 'supergroup',
    },
    settings: {
      type: groupSettingsSchema,
      default: () => ({}),
    },
    stats: {
      type: groupStatsSchema,
      default: () => ({}),
    },
    bestPostingHours: {
      type: [bestPostingHoursSchema],
      default: [],
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'telegram_groups',
  }
);

// Indexes
telegramGroupSchema.index({ 'settings.isActive': 1 });
telegramGroupSchema.index({ 'settings.allowedAdTypes': 1 });

export const TelegramGroup: Model<TelegramGroupDocument> =
  models['TelegramGroup'] || model<TelegramGroupDocument>('TelegramGroup', telegramGroupSchema);
