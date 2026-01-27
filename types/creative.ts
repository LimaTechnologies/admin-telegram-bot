import type { ObjectId, Timestamps } from './common';

export type CreativeType = 'image' | 'video' | 'text';
export type CTAStyle = 'soft' | 'hard';

export interface CreativeMedia {
  type: CreativeType;
  url?: string;
  s3Key?: string;
  thumbnailUrl?: string;
  duration?: number; // For videos, in seconds
}

export interface CreativePerformance {
  timesUsed: number;
  totalViews: number;
  totalClicks: number;
  ctr: number;
  avgEngagement: number;
  performanceScore: number; // 0-100
}

export interface ICreative extends Timestamps {
  _id: ObjectId;
  name: string;
  media: CreativeMedia;
  caption: string;
  ctaStyle: CTAStyle;
  ctaText?: string;
  ctaUrl?: string;
  tags: string[];
  isCompliant: boolean;
  complianceNotes?: string;
  isABTest: boolean;
  abTestVariant?: string;
  performance: CreativePerformance;
  createdBy: ObjectId;
}

export interface CreateCreativeInput {
  name: string;
  media: CreativeMedia;
  caption: string;
  ctaStyle: CTAStyle;
  ctaText?: string;
  ctaUrl?: string;
  tags?: string[];
  isABTest?: boolean;
  abTestVariant?: string;
}

export interface UpdateCreativeInput {
  name?: string;
  caption?: string;
  ctaStyle?: CTAStyle;
  ctaText?: string;
  ctaUrl?: string;
  tags?: string[];
  isCompliant?: boolean;
  complianceNotes?: string;
}
