import { Schema, model, models, type Document, type Model, type Types } from 'mongoose';
import type { IPostHistory, PostMetrics } from '$types/post-history';

export interface PostHistoryDocument extends Omit<IPostHistory, '_id' | 'scheduledPostId' | 'campaignId' | 'creativeId' | 'groupId'>, Document {
  scheduledPostId: Types.ObjectId;
  campaignId: Types.ObjectId;
  creativeId: Types.ObjectId;
  groupId: Types.ObjectId;
}

const postMetricsSchema = new Schema<PostMetrics>(
  {
    views: {
      type: Number,
      default: 0,
    },
    clicks: {
      type: Number,
      default: 0,
    },
    reactions: {
      type: Number,
      default: 0,
    },
    replies: {
      type: Number,
      default: 0,
    },
    shares: {
      type: Number,
      default: 0,
    },
    deletedAt: {
      type: Date,
    },
  },
  { _id: false }
);

const postHistorySchema = new Schema<PostHistoryDocument>(
  {
    scheduledPostId: {
      type: Schema.Types.ObjectId,
      ref: 'ScheduledPost',
      required: true,
      index: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    creativeId: {
      type: Schema.Types.ObjectId,
      ref: 'Creative',
      required: true,
      index: true,
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'TelegramGroup',
      required: true,
      index: true,
    },
    messageId: {
      type: String,
      required: true,
    },
    sentAt: {
      type: Date,
      required: true,
      index: true,
    },
    metrics: {
      type: postMetricsSchema,
      default: () => ({}),
    },
    revenue: {
      type: Number,
      default: 0,
    },
    processingTimeMs: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'post_history',
  }
);

// Indexes for analytics
postHistorySchema.index({ sentAt: -1 });
postHistorySchema.index({ campaignId: 1, sentAt: -1 });
postHistorySchema.index({ groupId: 1, sentAt: -1 });
postHistorySchema.index({ creativeId: 1, sentAt: -1 });

export const PostHistory: Model<PostHistoryDocument> =
  models['PostHistory'] || model<PostHistoryDocument>('PostHistory', postHistorySchema);
