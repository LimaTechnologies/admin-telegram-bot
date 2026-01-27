import type { ObjectId, Timestamps } from './common';

export type ModelTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface ModelPerformance {
  totalCampaigns: number;
  totalPosts: number;
  totalViews: number;
  totalClicks: number;
  totalRevenue: number;
  conversionRate: number;
}

export interface IModel extends Timestamps {
  _id: ObjectId;
  name: string;
  username: string;
  onlyfansUrl: string;
  profileImageUrl?: string;
  niche: string[];
  tier: ModelTier;
  subscriptionPrice?: number;
  bio?: string;
  isActive: boolean;
  performance: ModelPerformance;
}

export interface CreateModelInput {
  name: string;
  username: string;
  onlyfansUrl: string;
  profileImageUrl?: string;
  niche?: string[];
  tier?: ModelTier;
  subscriptionPrice?: number;
  bio?: string;
}

export interface UpdateModelInput {
  name?: string;
  onlyfansUrl?: string;
  profileImageUrl?: string;
  niche?: string[];
  tier?: ModelTier;
  subscriptionPrice?: number;
  bio?: string;
  isActive?: boolean;
}
