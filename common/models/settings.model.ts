import { Schema, model, models, type Document, type Model } from 'mongoose';
import type { ISettings, BotSettings, SpamControlSettings, NotificationSettings } from '$types/settings';

export interface SettingsDocument extends Omit<ISettings, '_id'>, Document {}

const botSettingsSchema = new Schema<BotSettings>(
  {
    token: {
      type: String,
      required: true,
    },
    username: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const spamControlSettingsSchema = new Schema<SpamControlSettings>(
  {
    globalMaxAdsPerHour: {
      type: Number,
      default: 100,
    },
    globalCooldownMinutes: {
      type: Number,
      default: 5,
    },
    requireManualApproval: {
      type: Boolean,
      default: false,
    },
    keywordBlacklist: {
      type: [String],
      default: [],
    },
    emergencyStopActive: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const notificationSettingsSchema = new Schema<NotificationSettings>(
  {
    emailOnError: {
      type: Boolean,
      default: true,
    },
    emailOnLowBalance: {
      type: Boolean,
      default: true,
    },
    emailOnDealEnd: {
      type: Boolean,
      default: true,
    },
    errorEmailRecipients: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const settingsSchema = new Schema<SettingsDocument>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'default',
    },
    bot: {
      type: botSettingsSchema,
      required: true,
    },
    spamControl: {
      type: spamControlSettingsSchema,
      default: () => ({}),
    },
    notifications: {
      type: notificationSettingsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    collection: 'settings',
  }
);

export const Settings: Model<SettingsDocument> = models['Settings'] || model<SettingsDocument>('Settings', settingsSchema);

// Helper to get or create default settings
export async function getSettings(): Promise<SettingsDocument> {
  let settings = await Settings.findOne({ key: 'default' });
  if (!settings) {
    settings = await Settings.create({
      key: 'default',
      bot: {
        token: process.env['TELEGRAM_BOT_TOKEN'] || '',
        isActive: false,
      },
    });
  }
  return settings;
}
