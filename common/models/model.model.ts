import { Schema, model, models, type Document, type Model } from 'mongoose';
import type { IModel, ModelPerformance } from '$types/model';

export interface ModelDocument extends Omit<IModel, '_id'>, Document {}

const modelPerformanceSchema = new Schema<ModelPerformance>(
  {
    totalCampaigns: {
      type: Number,
      default: 0,
    },
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
    conversionRate: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const modelSchema = new Schema<ModelDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    onlyfansUrl: {
      type: String,
      required: true,
    },
    profileImageUrl: {
      type: String,
    },
    niche: {
      type: [String],
      default: [],
      index: true,
    },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
      default: 'bronze',
    },
    subscriptionPrice: {
      type: Number,
    },
    bio: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    performance: {
      type: modelPerformanceSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    collection: 'models',
  }
);

// Indexes
modelSchema.index({ tier: 1, isActive: 1 });
modelSchema.index({ 'performance.conversionRate': -1 });

// Note: Using 'OFModel' to avoid conflict with mongoose's Model type
export const OFModel: Model<ModelDocument> = models['OFModel'] || model<ModelDocument>('OFModel', modelSchema);
