import type { ObjectId, Timestamps } from './common';

export type RiskLevel = 'low' | 'medium' | 'high';
export type FunnelStyle = 'direct' | 'landing' | 'chatbot';

export interface CasinoPerformance {
  totalCampaigns: number;
  totalPosts: number;
  totalClicks: number;
  totalDeposits: number;
  totalRevenue: number;
  conversionRate: number;
}

export interface ICasino extends Timestamps {
  _id: ObjectId;
  name: string;
  brand: string;
  websiteUrl: string;
  logoUrl?: string;
  geoTargeting: string[]; // Country codes
  riskLevel: RiskLevel;
  funnelStyle: FunnelStyle;
  minDeposit?: number;
  welcomeBonus?: string;
  isActive: boolean;
  performance: CasinoPerformance;
}

export interface CreateCasinoInput {
  name: string;
  brand: string;
  websiteUrl: string;
  logoUrl?: string;
  geoTargeting?: string[];
  riskLevel?: RiskLevel;
  funnelStyle?: FunnelStyle;
  minDeposit?: number;
  welcomeBonus?: string;
}

export interface UpdateCasinoInput {
  name?: string;
  websiteUrl?: string;
  logoUrl?: string;
  geoTargeting?: string[];
  riskLevel?: RiskLevel;
  funnelStyle?: FunnelStyle;
  minDeposit?: number;
  welcomeBonus?: string;
  isActive?: boolean;
}
