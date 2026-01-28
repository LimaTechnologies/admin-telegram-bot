import { Schema, model, models, type Document, type Model } from 'mongoose';
import type { ITelegramGroup, GroupSettings, GroupStats, BestPostingHours, BotPermissions } from '$types/telegram-group';

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

const botPermissionsSchema = new Schema<BotPermissions>(
  {
    canPostMessages: {
      type: Boolean,
      default: false,
    },
    canDeleteMessages: {
      type: Boolean,
      default: false,
    },
    canPinMessages: {
      type: Boolean,
      default: false,
    },
    canInviteUsers: {
      type: Boolean,
      default: false,
    },
    canRestrictMembers: {
      type: Boolean,
      default: false,
    },
    canPromoteMembers: {
      type: Boolean,
      default: false,
    },
    canChangeInfo: {
      type: Boolean,
      default: false,
    },
    canManageChat: {
      type: Boolean,
      default: false,
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
    description: {
      type: String,
    },
    inviteLink: {
      type: String,
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
    botPermissions: {
      type: botPermissionsSchema,
    },
    lastSyncAt: {
      type: Date,
    },
    discoveredAt: {
      type: Date,
    },
    isAutoDiscovered: {
      type: Boolean,
      default: false,
    },
    lastMessageId: {
      type: Number,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    postsToday: {
      type: Number,
      default: 0,
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
telegramGroupSchema.index({ isAutoDiscovered: 1 });
telegramGroupSchema.index({ lastSyncAt: 1 });

export const TelegramGroup: Model<TelegramGroupDocument> =
  models['TelegramGroup'] || model<TelegramGroupDocument>('TelegramGroup', telegramGroupSchema);
