import type { ObjectId, Timestamps } from './common';

export type ScheduleType = 'fixed' | 'smart' | 'randomized';
export type PostStatus = 'pending' | 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface IScheduledPost extends Timestamps {
  _id: ObjectId;
  campaignId: ObjectId;
  creativeId: ObjectId;
  groupId: ObjectId;
  scheduledFor: Date;
  scheduleType: ScheduleType;
  status: PostStatus;
  priority: number;
  attempts: number;
  lastError?: string;
  sentAt?: Date;
  messageId?: string;
}

export interface CreateScheduledPostInput {
  campaignId: string;
  creativeId: string;
  groupId: string;
  scheduledFor: string;
  scheduleType: ScheduleType;
  priority?: number;
}

export interface UpdateScheduledPostInput {
  scheduledFor?: string;
  status?: PostStatus;
  priority?: number;
}
