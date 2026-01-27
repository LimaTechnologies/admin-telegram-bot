import type { ObjectId, Timestamps } from './common';
import type { CampaignType } from './campaign';

export type RevenueModel = 'flat_fee' | 'cpm' | 'cpc' | 'rev_share';
export type DealStatus = 'negotiating' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface DealTerms {
  revenueModel: RevenueModel;
  amount: number; // Rate based on revenue model
  currency: string;
  minimumPosts?: number;
  minimumViews?: number;
  revSharePercentage?: number; // For rev_share model
}

export interface DealPerformance {
  totalPosts: number;
  totalViews: number;
  totalClicks: number;
  totalRevenue: number;
  expectedRevenue: number;
  roi: number;
  isOverPerforming: boolean;
}

export interface IDeal extends Timestamps {
  _id: ObjectId;
  name: string;
  type: CampaignType;
  modelId?: ObjectId;
  casinoId?: ObjectId;
  status: DealStatus;
  terms: DealTerms;
  startDate: Date;
  endDate?: Date;
  performance: DealPerformance;
  notes?: string;
  createdBy: ObjectId;
}

export interface CreateDealInput {
  name: string;
  type: CampaignType;
  modelId?: string;
  casinoId?: string;
  terms: DealTerms;
  startDate: string;
  endDate?: string;
  notes?: string;
}

export interface UpdateDealInput {
  name?: string;
  status?: DealStatus;
  terms?: Partial<DealTerms>;
  endDate?: string;
  notes?: string;
}
