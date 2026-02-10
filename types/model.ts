import type { ObjectId, Timestamps } from './common';

export type ModelTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type ProductType = 'subscription' | 'content' | 'ppv' | 'custom';

export interface ModelPerformance {
  totalCampaigns: number;
  totalPosts: number;
  totalViews: number;
  totalClicks: number;
  totalRevenue: number;
  conversionRate: number;
}

// Product for sale within a model's profile
export interface ModelProduct {
  _id: ObjectId;
  name: string;
  description?: string;
  type: ProductType;
  price: number;
  currency: 'BRL' | 'USD';
  previewImages: string[]; // S3 keys - preview before purchase
  contentPhotos: string[]; // S3 keys - actual content delivered after purchase
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IModel extends Timestamps {
  _id: ObjectId;
  name: string;
  username: string;
  onlyfansUrl: string;
  profileImageUrl?: string;
  // NEW: Multiple preview photos (S3 keys)
  previewPhotos: string[];
  // NEW: Products for sale
  products: ModelProduct[];
  niche: string[];
  tier: ModelTier;
  subscriptionPrice?: number;
  bio?: string;
  isActive: boolean;
  // NEW: Referral link for tracking
  referralLink?: string;
  performance: ModelPerformance;
}

export interface CreateModelInput {
  name: string;
  username: string;
  onlyfansUrl: string;
  profileImageUrl?: string;
  previewPhotos?: string[];
  referralLink?: string;
  niche?: string[];
  tier?: ModelTier;
  subscriptionPrice?: number;
  bio?: string;
}

export interface UpdateModelInput {
  name?: string;
  onlyfansUrl?: string;
  profileImageUrl?: string;
  previewPhotos?: string[];
  referralLink?: string;
  niche?: string[];
  tier?: ModelTier;
  subscriptionPrice?: number;
  bio?: string;
  isActive?: boolean;
}

// Product management inputs
export interface CreateProductInput {
  name: string;
  description?: string;
  type: ProductType;
  price: number;
  currency?: 'BRL' | 'USD';
  previewImages?: string[];
  contentPhotos?: string[]; // Actual content to deliver after purchase
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  isActive?: boolean;
}
