import { Schema, model, models, type Document, type Model, type Types } from 'mongoose';
import type { IDeal, DealTerms, DealPerformance } from '$types/deal';

export interface DealDocument extends Omit<IDeal, '_id' | 'modelId' | 'casinoId' | 'createdBy'>, Document {
  modelId?: Types.ObjectId;
  casinoId?: Types.ObjectId;
  createdBy: Types.ObjectId;
}

const dealTermsSchema = new Schema<DealTerms>(
  {
    revenueModel: {
      type: String,
      enum: ['flat_fee', 'cpm', 'cpc', 'rev_share'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    minimumPosts: {
      type: Number,
    },
    minimumViews: {
      type: Number,
    },
    revSharePercentage: {
      type: Number,
    },
  },
  { _id: false }
);

const dealPerformanceSchema = new Schema<DealPerformance>(
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
    expectedRevenue: {
      type: Number,
      default: 0,
    },
    roi: {
      type: Number,
      default: 0,
    },
    isOverPerforming: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const dealSchema = new Schema<DealDocument>(
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
    modelId: {
      type: Schema.Types.ObjectId,
      ref: 'OFModel',
      index: true,
    },
    casinoId: {
      type: Schema.Types.ObjectId,
      ref: 'Casino',
      index: true,
    },
    status: {
      type: String,
      enum: ['negotiating', 'active', 'paused', 'completed', 'cancelled'],
      default: 'negotiating',
      index: true,
    },
    terms: {
      type: dealTermsSchema,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    performance: {
      type: dealPerformanceSchema,
      default: () => ({}),
    },
    notes: {
      type: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'deals',
  }
);

// Indexes
dealSchema.index({ status: 1, type: 1 });
dealSchema.index({ startDate: 1, endDate: 1 });
dealSchema.index({ createdBy: 1 });

export const Deal: Model<DealDocument> = models['Deal'] || model<DealDocument>('Deal', dealSchema);
