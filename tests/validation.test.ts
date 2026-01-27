import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Test Zod validation schemas similar to what's used in tRPC routers
describe('Campaign Validation', () => {
  const campaignSchema = z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['onlyfans', 'casino']),
    status: z.enum(['draft', 'active', 'paused', 'scheduled', 'ended']).default('draft'),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    targetGroups: z.array(z.string()).min(1),
  });

  it('should validate valid campaign data', () => {
    const validData = {
      name: 'Summer Promo',
      type: 'onlyfans',
      targetGroups: ['group-1', 'group-2'],
    };

    const result = campaignSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('draft');
      expect(result.data.priority).toBe('medium');
    }
  });

  it('should reject empty name', () => {
    const invalidData = {
      name: '',
      type: 'casino',
      targetGroups: ['group-1'],
    };

    const result = campaignSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid type', () => {
    const invalidData = {
      name: 'Test',
      type: 'invalid-type',
      targetGroups: ['group-1'],
    };

    const result = campaignSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject empty targetGroups', () => {
    const invalidData = {
      name: 'Test',
      type: 'onlyfans',
      targetGroups: [],
    };

    const result = campaignSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('Email Validation', () => {
  const emailSchema = z.string().email();

  it('should validate correct emails', () => {
    expect(emailSchema.safeParse('test@example.com').success).toBe(true);
    expect(emailSchema.safeParse('user.name@domain.org').success).toBe(true);
    expect(emailSchema.safeParse('user+tag@gmail.com').success).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(emailSchema.safeParse('invalid').success).toBe(false);
    expect(emailSchema.safeParse('missing@domain').success).toBe(false);
    expect(emailSchema.safeParse('@nodomain.com').success).toBe(false);
    expect(emailSchema.safeParse('').success).toBe(false);
  });
});

describe('Pagination Validation', () => {
  const paginationSchema = z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(20),
  });

  it('should use defaults when not provided', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('should validate custom values', () => {
    const result = paginationSchema.parse({ page: 5, limit: 50 });
    expect(result.page).toBe(5);
    expect(result.limit).toBe(50);
  });

  it('should reject invalid page', () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(paginationSchema.safeParse({ page: -1 }).success).toBe(false);
  });

  it('should reject invalid limit', () => {
    expect(paginationSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(paginationSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});

describe('Risk Level Validation', () => {
  const riskSchema = z.enum(['low', 'medium', 'high']);

  it('should accept valid risk levels', () => {
    expect(riskSchema.safeParse('low').success).toBe(true);
    expect(riskSchema.safeParse('medium').success).toBe(true);
    expect(riskSchema.safeParse('high').success).toBe(true);
  });

  it('should reject invalid risk levels', () => {
    expect(riskSchema.safeParse('very-high').success).toBe(false);
    expect(riskSchema.safeParse('').success).toBe(false);
    expect(riskSchema.safeParse(null).success).toBe(false);
  });
});
