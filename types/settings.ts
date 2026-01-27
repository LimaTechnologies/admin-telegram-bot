import type { ObjectId, Timestamps } from './common';

export interface BotSettings {
  token: string;
  username?: string;
  isActive: boolean;
}

export interface SpamControlSettings {
  globalMaxAdsPerHour: number;
  globalCooldownMinutes: number;
  requireManualApproval: boolean;
  keywordBlacklist: string[];
  emergencyStopActive: boolean;
}

export interface NotificationSettings {
  emailOnError: boolean;
  emailOnLowBalance: boolean;
  emailOnDealEnd: boolean;
  errorEmailRecipients: string[];
}

export interface ISettings extends Timestamps {
  _id: ObjectId;
  key: string;
  bot: BotSettings;
  spamControl: SpamControlSettings;
  notifications: NotificationSettings;
}

export interface UpdateSettingsInput {
  bot?: Partial<BotSettings>;
  spamControl?: Partial<SpamControlSettings>;
  notifications?: Partial<NotificationSettings>;
}
