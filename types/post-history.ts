import type { ObjectId, Timestamps } from './common';

export interface PostMetrics {
  views: number;
  clicks: number;
  reactions: number;
  replies: number;
  shares: number;
  deletedAt?: Date;
}

export interface IPostHistory extends Timestamps {
  _id: ObjectId;
  scheduledPostId: ObjectId;
  campaignId: ObjectId;
  creativeId: ObjectId;
  groupId: ObjectId;
  messageId: string;
  sentAt: Date;
  metrics: PostMetrics;
  revenue?: number;
  processingTimeMs: number;
}

export interface PostHistoryFilters {
  campaignId?: string;
  creativeId?: string;
  groupId?: string;
  startDate?: string;
  endDate?: string;
}
