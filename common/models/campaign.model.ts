import { Schema, model, models, type Document, type Model, type Types } from 'mongoose';
import type { ICampaign, CampaignSchedule, CampaignTargeting, CampaignPerformance } from '$types/campaign';

export interface CampaignDocument extends Omit<ICampaign, '_id' | 'targeting' | 'creativeIds' | 'modelId' | 'casinoId' | 'dealId' | 'createdBy'>, Document {
  targeting: {
    groupIds: Types.ObjectId[];
    excludeGroupIds?: Types.ObjectId[];
  };
  creativeIds: Types.ObjectId[];
  modelId?: Types.ObjectId;
  casinoId?: Types.ObjectId;
  dealId?: Types.ObjectId;
  createdBy: Types.ObjectId;
}

const campaignScheduleSchema = new Schema<CampaignSchedule>(
  {
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    dailyCap: {
      type: Number,
    },
    weeklyCap: {
      type: Number,
    },
  },
  { _id: false }
);

const campaignTargetingSchema = new Schema<CampaignTargeting>(
  {
    groupIds: {
      type: [Schema.Types.ObjectId],
      ref: 'TelegramGroup',
      default: [],
    },
    excludeGroupIds: {
      type: [Schema.Types.ObjectId],
      ref: 'TelegramGroup',
      default: [],
    },
  },
  { _id: false }
);

const campaignPerformanceSchema = new Schema<CampaignPerformance>(
  {
    totalPosts: {
      type: Number,
      default: 0,
    },
    totalViews: {
      type: Number,
      default: 0,
    },
    totalClicks: {
      type: Number,
      default: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
    ctr: {
      type: Number,
      default: 0,
    },
    engagement: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const campaignSchema = new Schema<CampaignDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['onlyfans', 'casino'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'scheduled', 'ended'],
      default: 'draft',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    description: {
      type: String,
    },
    schedule: {
      type: campaignScheduleSchema,
      required: true,
    },
    targeting: {
      type: campaignTargetingSchema,
      default: () => ({ groupIds: [] }),
    },
    creativeIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Creative',
      default: [],
    },
    modelId: {
      type: Schema.Types.ObjectId,
      ref: 'Model',
      index: true,
    },
    casinoId: {
      type: Schema.Types.ObjectId,
      ref: 'Casino',
      index: true,
    },
    dealId: {
      type: Schema.Types.ObjectId,
      ref: 'Deal',
      index: true,
    },
    performance: {
      type: campaignPerformanceSchema,
      default: () => ({}),
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'campaigns',
  }
);

// Indexes
campaignSchema.index({ status: 1, type: 1 });
campaignSchema.index({ 'schedule.startDate': 1, 'schedule.endDate': 1 });
campaignSchema.index({ createdBy: 1, status: 1 });

export const Campaign: Model<CampaignDocument> = models['Campaign'] || model<CampaignDocument>('Campaign', campaignSchema);
