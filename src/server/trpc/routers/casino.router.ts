import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, operatorProcedure } from '../trpc';
import { withAudit } from '../middleware/audit.middleware';
import { Casino } from '@common';

const createCasinoSchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().min(1).max(100),
  websiteUrl: z.string().url(),
  logoUrl: z.string().url().optional(),
  geoTargeting: z.array(z.string()).default([]),
  riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  funnelStyle: z.enum(['direct', 'landing', 'chatbot']).default('direct'),
  minDeposit: z.number().positive().optional(),
  welcomeBonus: z.string().optional(),
});

const updateCasinoSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  websiteUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  geoTargeting: z.array(z.string()).optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  funnelStyle: z.enum(['direct', 'landing', 'chatbot']).optional(),
  minDeposit: z.number().positive().optional(),
  welcomeBonus: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const casinoRouter = router({
  // List casinos
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        riskLevel: z.enum(['low', 'medium', 'high']).optional(),
        geoTargeting: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const { page, limit, search, riskLevel, geoTargeting, isActive } = input;

      const filter: Record<string, unknown> = {};
      if (search) {
        filter['$or'] = [
          { name: { $regex: search, $options: 'i' } },
          { brand: { $regex: search, $options: 'i' } },
        ];
      }
      if (riskLevel) filter['riskLevel'] = riskLevel;
      if (geoTargeting?.length) filter['geoTargeting'] = { $in: geoTargeting };
      if (isActive !== undefined) filter['isActive'] = isActive;

      const [casinos, total] = await Promise.all([
        Casino.find(filter)
          .sort({ 'performance.conversionRate': -1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select('-__v'),
        Casino.countDocuments(filter),
      ]);

      return {
        data: casinos.map((c) => c.toObject()),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  // Get single casino
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const casino = await Casino.findById(input.id).select('-__v');
      if (!casino) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Casino not found' });
      }
      return casino.toObject();
    }),

  // Get all active casinos (for selection)
  getActive: protectedProcedure.query(async () => {
    const casinos = await Casino.find({ isActive: true })
      .sort({ name: 1 })
      .select('_id name brand riskLevel');
    return casinos.map((c) => c.toObject());
  }),

  // Create casino (operator+)
  create: operatorProcedure
    .input(createCasinoSchema)
    .use(
      withAudit({
        action: 'casino.create',
        entityType: 'casino',
        getAfter: (_, result) => result,
      })
    )
    .mutation(async ({ input }) => {
      const casino = await Casino.create(input);
      return casino.toObject();
    }),

  // Update casino (operator+)
  update: operatorProcedure
    .input(updateCasinoSchema)
    .use(
      withAudit({
        action: 'casino.update',
        entityType: 'casino',
        getEntityId: (input) => (input as { id: string }).id,
        getBefore: async (input) => {
          const casino = await Casino.findById((input as { id: string }).id);
          return casino;
        },
        getAfter: (_, result) => result,
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;

      const casino = await Casino.findByIdAndUpdate(id, data, { new: true }).select('-__v');
      if (!casino) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Casino not found' });
      }

      return casino.toObject();
    }),

  // Delete casino (operator+)
  delete: operatorProcedure
    .input(z.object({ id: z.string() }))
    .use(
      withAudit({
        action: 'casino.delete',
        entityType: 'casino',
        getEntityId: (input) => (input as { id: string }).id,
        getBefore: async (input) => {
          const casino = await Casino.findById((input as { id: string }).id);
          return casino;
        },
      })
    )
    .mutation(async ({ input }) => {
      const result = await Casino.findByIdAndDelete(input.id);
      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Casino not found' });
      }
      return { success: true };
    }),

  // Get casino stats
  getStats: protectedProcedure.query(async () => {
    const stats = await Casino.aggregate([
      {
        $group: {
          _id: '$riskLevel',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$performance.totalRevenue' },
          totalDeposits: { $sum: '$performance.totalDeposits' },
          avgConversion: { $avg: '$performance.conversionRate' },
        },
      },
    ]);

    const result: Record<string, { count: number; totalRevenue: number; totalDeposits: number; avgConversion: number }> = {};
    stats.forEach((s) => {
      result[s._id] = {
        count: s.count,
        totalRevenue: s.totalRevenue,
        totalDeposits: s.totalDeposits,
        avgConversion: s.avgConversion,
      };
    });

    return result;
  }),
});
