import type { ObjectId, Timestamps } from './common';

export type CampaignType = 'onlyfans' | 'casino';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'scheduled' | 'ended';
export type CampaignPriority = 'low' | 'medium' | 'high';

export interface CampaignSchedule {
  startDate: Date;
  endDate?: Date;
  dailyCap?: number;
  weeklyCap?: number;
}

export interface CampaignTargeting {
  groupIds: ObjectId[];
  excludeGroupIds?: ObjectId[];
}

export interface CampaignPerformance {
  totalPosts: number;
  totalViews: number;
  totalClicks: number;
  totalRevenue: number;
  ctr: number;
  engagement: number;
}

export interface ICampaign extends Timestamps {
  _id: ObjectId;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  priority: CampaignPriority;
  description?: string;
  schedule: CampaignSchedule;
  targeting: CampaignTargeting;
  creativeIds: ObjectId[];
  modelId?: ObjectId; // For OnlyFans campaigns
  casinoId?: ObjectId; // For Casino campaigns
  dealId?: ObjectId;
  performance: CampaignPerformance;
  createdBy: ObjectId;
}

export interface CreateCampaignInput {
  name: string;
  type: CampaignType;
  priority?: CampaignPriority;
  description?: string;
  schedule: Omit<CampaignSchedule, 'startDate'> & { startDate: string };
  targeting: { groupIds: string[] };
  creativeIds: string[];
  modelId?: string;
  casinoId?: string;
  dealId?: string;
}

export interface UpdateCampaignInput {
  name?: string;
  status?: CampaignStatus;
  priority?: CampaignPriority;
  description?: string;
  schedule?: Partial<CampaignSchedule>;
  targeting?: Partial<CampaignTargeting>;
  creativeIds?: string[];
}
