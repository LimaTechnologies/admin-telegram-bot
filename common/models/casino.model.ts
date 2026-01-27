import { Schema, model, models, type Document, type Model } from 'mongoose';
import type { ICasino, CasinoPerformance } from '$types/casino';

export interface CasinoDocument extends Omit<ICasino, '_id'>, Document {}

const casinoPerformanceSchema = new Schema<CasinoPerformance>(
  {
    totalCampaigns: {
      type: Number,
      default: 0,
    },
    totalPosts: {
      type: Number,
      default: 0,
    },
    totalClicks: {
      type: Number,
      default: 0,
    },
    totalDeposits: {
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

const casinoSchema = new Schema<CasinoDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    websiteUrl: {
      type: String,
      required: true,
    },
    logoUrl: {
      type: String,
    },
    geoTargeting: {
      type: [String],
      default: [],
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    funnelStyle: {
      type: String,
      enum: ['direct', 'landing', 'chatbot'],
      default: 'direct',
    },
    minDeposit: {
      type: Number,
    },
    welcomeBonus: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    performance: {
      type: casinoPerformanceSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    collection: 'casinos',
  }
);

// Indexes
casinoSchema.index({ riskLevel: 1, isActive: 1 });
casinoSchema.index({ 'performance.conversionRate': -1 });

export const Casino: Model<CasinoDocument> = models['Casino'] || model<CasinoDocument>('Casino', casinoSchema);
