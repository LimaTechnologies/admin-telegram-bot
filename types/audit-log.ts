import type { ObjectId, Timestamps } from './common';

export type AuditAction =
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.login'
  | 'user.logout'
  | 'user.resetPassword'
  | 'group.create'
  | 'group.update'
  | 'group.delete'
  | 'campaign.create'
  | 'campaign.update'
  | 'campaign.delete'
  | 'campaign.start'
  | 'campaign.pause'
  | 'campaign.stop'
  | 'creative.create'
  | 'creative.update'
  | 'creative.delete'
  | 'creative.upload'
  | 'post.schedule'
  | 'post.create'
  | 'post.update'
  | 'post.delete'
  | 'post.cancel'
  | 'post.send'
  | 'post.fail'
  | 'model.create'
  | 'model.update'
  | 'model.delete'
  | 'casino.create'
  | 'casino.update'
  | 'casino.delete'
  | 'deal.create'
  | 'deal.update'
  | 'deal.delete'
  | 'settings.update'
  | 'spam.emergency_stop'
  | 'spam.resume'
  | 'group.discover'
  | 'group.sync'
  | 'group.syncAll'
  | 'group.testMessage'
  | 'group.deleteMessage'
  | 'bot.sendMessage'
  | 'bot.deleteMessage'
  | 'bot.banUser'
  | 'bot.unbanUser'
  | 'bot.pinMessage'
  | 'bot.unpinMessage'
  | 'queue.retryJob'
  | 'queue.removeJob'
  | 'queue.clean'
  | 'queue.pause'
  | 'queue.resume'
  | 'queue.retryAllFailed'
  | 'queue.forceSend'
  | 'queue.reschedule'
  | 'queue.scheduleMessage';

export type EntityType =
  | 'user'
  | 'group'
  | 'campaign'
  | 'creative'
  | 'post'
  | 'model'
  | 'casino'
  | 'deal'
  | 'settings'
  | 'bot'
  | 'queue';

export interface AuditChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  route: string;
  timestamp: Date;
  duration: number;
  success: boolean;
  errorMessage?: string;
}

export interface IAuditLog extends Timestamps {
  _id: ObjectId;
  userId: ObjectId;
  action: AuditAction;
  entityType: EntityType;
  entityId?: ObjectId;
  changes: AuditChanges;
  metadata: AuditMetadata;
}

export interface AuditLogFilters {
  userId?: string;
  action?: AuditAction;
  entityType?: EntityType;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  success?: boolean;
}
