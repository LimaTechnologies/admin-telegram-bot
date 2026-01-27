import { Schema, model, models, type Document, type Model, type Types } from 'mongoose';
import type { IScheduledPost } from '$types/scheduled-post';

export interface ScheduledPostDocument extends Omit<IScheduledPost, '_id' | 'campaignId' | 'creativeId' | 'groupId'>, Document {
  campaignId: Types.ObjectId;
  creativeId: Types.ObjectId;
  groupId: Types.ObjectId;
}

const scheduledPostSchema = new Schema<ScheduledPostDocument>(
  {
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
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    scheduleType: {
      type: String,
      enum: ['fixed', 'smart', 'randomized'],
      default: 'fixed',
    },
    status: {
      type: String,
      enum: ['pending', 'queued', 'processing', 'sent', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    priority: {
      type: Number,
      default: 0,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
    },
    sentAt: {
      type: Date,
    },
    messageId: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'scheduled_posts',
  }
);

// Indexes for queue processing
scheduledPostSchema.index({ status: 1, scheduledFor: 1 });
scheduledPostSchema.index({ groupId: 1, status: 1 });
scheduledPostSchema.index({ campaignId: 1, status: 1 });

export const ScheduledPost: Model<ScheduledPostDocument> =
  models['ScheduledPost'] || model<ScheduledPostDocument>('ScheduledPost', scheduledPostSchema);
