import type { ObjectId, Timestamps } from './common';

export type GroupType = 'public' | 'private' | 'supergroup' | 'channel';
export type AllowedAdType = 'onlyfans' | 'casino' | 'both';

export interface GroupSettings {
  maxAdsPerDay: number;
  cooldownMinutes: number;
  allowedAdTypes: AllowedAdType;
  isActive: boolean;
  requiresApproval: boolean;
}

export interface GroupStats {
  memberCount: number;
  totalPosts: number;
  totalViews: number;
  avgEngagement: number;
  lastPostAt?: Date;
}

export interface BestPostingHours {
  hour: number;
  engagement: number;
}

export interface ITelegramGroup extends Timestamps {
  _id: ObjectId;
  telegramId: string;
  name: string;
  username?: string;
  type: GroupType;
  settings: GroupSettings;
  stats: GroupStats;
  bestPostingHours: BestPostingHours[];
  joinedAt: Date;
}

export interface CreateGroupInput {
  telegramId: string;
  name: string;
  username?: string;
  type: GroupType;
}

export interface UpdateGroupInput {
  name?: string;
  settings?: Partial<GroupSettings>;
}
