import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, operatorProcedure } from '../trpc';
import { withAudit } from '../middleware/audit.middleware';
import { OFModel } from '@common';

const createModelSchema = z.object({
  name: z.string().min(1).max(200),
  username: z.string().min(1).max(100),
  onlyfansUrl: z.string().url(),
  profileImageUrl: z.string().url().optional(),
  niche: z.array(z.string()).default([]),
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']).default('bronze'),
  subscriptionPrice: z.number().positive().optional(),
  bio: z.string().max(1000).optional(),
});

const updateModelSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  onlyfansUrl: z.string().url().optional(),
  profileImageUrl: z.string().url().optional(),
  niche: z.array(z.string()).optional(),
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']).optional(),
  subscriptionPrice: z.number().positive().optional(),
  bio: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});

export const modelRouter = router({
  // List models
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        tier: z.enum(['bronze', 'silver', 'gold', 'platinum']).optional(),
        niche: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const { page, limit, search, tier, niche, isActive } = input;

      const filter: Record<string, unknown> = {};
      if (search) {
        filter['$or'] = [
          { name: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
        ];
      }
      if (tier) filter['tier'] = tier;
      if (niche?.length) filter['niche'] = { $in: niche };
      if (isActive !== undefined) filter['isActive'] = isActive;

      const [models, total] = await Promise.all([
        OFModel.find(filter)
          .sort({ 'performance.conversionRate': -1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select('-__v'),
        OFModel.countDocuments(filter),
      ]);

      return {
        data: models.map((m) => m.toObject()),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  // Get single model
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const model = await OFModel.findById(input.id).select('-__v');
      if (!model) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Model not found' });
      }
      return model.toObject();
    }),

  // Get all active models (for selection)
  getActive: protectedProcedure.query(async () => {
    const models = await OFModel.find({ isActive: true })
      .sort({ name: 1 })
      .select('_id name username tier');
    return models.map((m) => m.toObject());
  }),

  // Create model (operator+)
  create: operatorProcedure
    .input(createModelSchema)
    .use(
      withAudit({
        action: 'model.create',
        entityType: 'model',
        getAfter: (_, result) => result,
      })
    )
    .mutation(async ({ input }) => {
      // Check if username already exists
      const existing = await OFModel.findOne({ username: input.username.toLowerCase() });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Username already exists' });
      }

      const model = await OFModel.create({
        ...input,
        username: input.username.toLowerCase(),
      });
      return model.toObject();
    }),

  // Update model (operator+)
  update: operatorProcedure
    .input(updateModelSchema)
    .use(
      withAudit({
        action: 'model.update',
        entityType: 'model',
        getEntityId: (input) => (input as { id: string }).id,
        getBefore: async (input) => {
          const model = await OFModel.findById((input as { id: string }).id);
          return model;
        },
        getAfter: (_, result) => result,
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;

      const model = await OFModel.findByIdAndUpdate(id, data, { new: true }).select('-__v');
      if (!model) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Model not found' });
      }

      return model.toObject();
    }),

  // Delete model (operator+)
  delete: operatorProcedure
    .input(z.object({ id: z.string() }))
    .use(
      withAudit({
        action: 'model.delete',
        entityType: 'model',
        getEntityId: (input) => (input as { id: string }).id,
        getBefore: async (input) => {
          const model = await OFModel.findById((input as { id: string }).id);
          return model;
        },
      })
    )
    .mutation(async ({ input }) => {
      const result = await OFModel.findByIdAndDelete(input.id);
      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Model not found' });
      }
      return { success: true };
    }),

  // Get all niches
  getNiches: protectedProcedure.query(async () => {
    const niches = await OFModel.distinct('niche');
    return niches;
  }),

  // Get model stats
  getStats: protectedProcedure.query(async () => {
    const stats = await OFModel.aggregate([
      {
        $group: {
          _id: '$tier',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$performance.totalRevenue' },
          avgConversion: { $avg: '$performance.conversionRate' },
        },
      },
    ]);

    const result: Record<string, { count: number; totalRevenue: number; avgConversion: number }> = {};
    stats.forEach((s) => {
      result[s._id] = {
        count: s.count,
        totalRevenue: s.totalRevenue,
        avgConversion: s.avgConversion,
      };
    });

    return result;
  }),
});
