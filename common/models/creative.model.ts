import { Schema, model, models, type Document, type Model, type Types } from 'mongoose';
import type { ICreative, CreativeMedia, CreativePerformance } from '$types/creative';

export interface CreativeDocument extends Omit<ICreative, '_id' | 'createdBy'>, Document {
  createdBy: Types.ObjectId;
}

const creativeMediaSchema = new Schema<CreativeMedia>(
  {
    type: {
      type: String,
      enum: ['image', 'video', 'text'],
      required: true,
    },
    url: {
      type: String,
    },
    s3Key: {
      type: String,
    },
    thumbnailUrl: {
      type: String,
    },
    duration: {
      type: Number,
    },
  },
  { _id: false }
);

const creativePerformanceSchema = new Schema<CreativePerformance>(
  {
    timesUsed: {
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
    ctr: {
      type: Number,
      default: 0,
    },
    avgEngagement: {
      type: Number,
      default: 0,
    },
    performanceScore: {
      type: Number,
      default: 50,
    },
  },
  { _id: false }
);

const creativeSchema = new Schema<CreativeDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    media: {
      type: creativeMediaSchema,
      required: true,
    },
    caption: {
      type: String,
      required: true,
    },
    ctaStyle: {
      type: String,
      enum: ['soft', 'hard'],
      default: 'soft',
    },
    ctaText: {
      type: String,
    },
    ctaUrl: {
      type: String,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    isCompliant: {
      type: Boolean,
      default: true,
    },
    complianceNotes: {
      type: String,
    },
    isABTest: {
      type: Boolean,
      default: false,
    },
    abTestVariant: {
      type: String,
    },
    performance: {
      type: creativePerformanceSchema,
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
    collection: 'creatives',
  }
);

// Indexes
creativeSchema.index({ 'media.type': 1 });
creativeSchema.index({ isCompliant: 1 });
creativeSchema.index({ 'performance.performanceScore': -1 });
creativeSchema.index({ createdBy: 1 });

export const Creative: Model<CreativeDocument> = models['Creative'] || model<CreativeDocument>('Creative', creativeSchema);
