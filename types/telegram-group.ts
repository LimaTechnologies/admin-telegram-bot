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

export interface BotPermissions {
  canPostMessages: boolean;
  canDeleteMessages: boolean;
  canPinMessages: boolean;
  canInviteUsers: boolean;
  canRestrictMembers: boolean;
  canPromoteMembers: boolean;
  canChangeInfo: boolean;
  canManageChat: boolean;
}

export interface ITelegramGroup extends Timestamps {
  _id: ObjectId;
  telegramId: string;
  name: string;
  username?: string;
  type: GroupType;
  description?: string;
  inviteLink?: string;
  settings: GroupSettings;
  stats: GroupStats;
  bestPostingHours: BestPostingHours[];
  botPermissions?: BotPermissions;
  lastSyncAt?: Date;
  discoveredAt?: Date;
  isAutoDiscovered: boolean;
  lastMessageId?: number;
  joinedAt: Date;
  postsToday?: number; // Resets daily, tracks ads sent today
}

export interface CreateGroupInput {
  telegramId: string;
  name: string;
  username?: string;
  type: GroupType;
  description?: string;
  isAutoDiscovered?: boolean;
}

export interface UpdateGroupInput {
  name?: string;
  settings?: Partial<GroupSettings>;
  description?: string;
  inviteLink?: string;
  botPermissions?: BotPermissions;
}

export interface GroupSyncResult {
  groupId: string;
  telegramId: string;
  name: string;
  success: boolean;
  error?: string;
  isNew: boolean;
}

export interface BotTaskJob {
  type: 'sync-groups' | 'sync-single-group' | 'send-message' | 'delete-message' | 'get-chat-info' | 'check-permissions';
  data: Record<string, unknown>;
}

export interface SendMessageJobData {
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  replyToMessageId?: number;
  disableNotification?: boolean;
  bypassRateLimit?: boolean; // Skip rate limit checks (for test messages)
}

export interface DeleteMessageJobData {
  chatId: string;
  messageId: number;
}

export interface SyncGroupJobData {
  telegramId?: string;
}
