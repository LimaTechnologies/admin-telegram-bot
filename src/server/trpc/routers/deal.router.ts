import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, operatorProcedure } from '../trpc';
import { withAudit } from '../middleware/audit.middleware';
import { Deal } from '@common';

const dealTermsSchema = z.object({
  revenueModel: z.enum(['flat_fee', 'cpm', 'cpc', 'rev_share']),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  minimumPosts: z.number().positive().optional(),
  minimumViews: z.number().positive().optional(),
  revSharePercentage: z.number().min(0).max(100).optional(),
});

const createDealSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['onlyfans', 'casino']),
  modelId: z.string().optional(),
  casinoId: z.string().optional(),
  terms: dealTermsSchema,
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const updateDealSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['negotiating', 'active', 'paused', 'completed', 'cancelled']).optional(),
  terms: dealTermsSchema.partial().optional(),
  endDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const dealRouter = router({
  // List deals
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        type: z.enum(['onlyfans', 'casino']).optional(),
        status: z.enum(['negotiating', 'active', 'paused', 'completed', 'cancelled']).optional(),
      })
    )
    .query(async ({ input }) => {
      const { page, limit, search, type, status } = input;

      const filter: Record<string, unknown> = {};
      if (search) {
        filter['name'] = { $regex: search, $options: 'i' };
      }
      if (type) filter['type'] = type;
      if (status) filter['status'] = status;

      const [deals, total] = await Promise.all([
        Deal.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('modelId', 'name username')
          .populate('casinoId', 'name brand')
          .populate('createdBy', 'name email')
          .select('-__v'),
        Deal.countDocuments(filter),
      ]);

      return {
        data: deals.map((d) => d.toObject()),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  // Get single deal
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const deal = await Deal.findById(input.id)
        .populate('modelId')
        .populate('casinoId')
        .populate('createdBy', 'name email')
        .select('-__v');

      if (!deal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });
      }
      return deal.toObject();
    }),

  // Create deal (operator+)
  create: operatorProcedure
    .input(createDealSchema)
    .use(
      withAudit({
        action: 'deal.create',
        entityType: 'deal',
        getAfter: (_, result) => result,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const deal = await Deal.create({
        ...input,
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        createdBy: ctx.session.userId,
      });
      return deal.toObject();
    }),

  // Update deal (operator+)
  update: operatorProcedure
    .input(updateDealSchema)
    .use(
      withAudit({
        action: 'deal.update',
        entityType: 'deal',
        getEntityId: (input) => (input as { id: string }).id,
        getBefore: async (input) => {
          const deal = await Deal.findById((input as { id: string }).id);
          return deal;
        },
        getAfter: (_, result) => result,
      })
    )
    .mutation(async ({ input }) => {
      const { id, terms, endDate, ...data } = input;

      const updateData: Record<string, unknown> = { ...data };

      if (terms) {
        Object.entries(terms).forEach(([key, value]) => {
          if (value !== undefined) {
            updateData[`terms.${key}`] = value;
          }
        });
      }

      if (endDate) {
        updateData['endDate'] = new Date(endDate);
      }

      const deal = await Deal.findByIdAndUpdate(id, updateData, { new: true })
        .populate('modelId', 'name username')
        .populate('casinoId', 'name brand')
        .select('-__v');

      if (!deal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });
      }

      return deal.toObject();
    }),

  // Delete deal (operator+)
  delete: operatorProcedure
    .input(z.object({ id: z.string() }))
    .use(
      withAudit({
        action: 'deal.delete',
        entityType: 'deal',
        getEntityId: (input) => (input as { id: string }).id,
        getBefore: async (input) => {
          const deal = await Deal.findById((input as { id: string }).id);
          return deal;
        },
      })
    )
    .mutation(async ({ input }) => {
      const result = await Deal.findByIdAndDelete(input.id);
      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });
      }
      return { success: true };
    }),

  // Get deal stats
  getStats: protectedProcedure.query(async () => {
    const stats = await Deal.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$performance.totalRevenue' },
          expectedRevenue: { $sum: '$performance.expectedRevenue' },
        },
      },
    ]);

    const result: Record<string, { count: number; totalRevenue: number; expectedRevenue: number }> = {};
    let total = 0;
    let totalRevenue = 0;

    stats.forEach((s) => {
      result[s._id] = {
        count: s.count,
        totalRevenue: s.totalRevenue,
        expectedRevenue: s.expectedRevenue,
      };
      total += s.count;
      totalRevenue += s.totalRevenue;
    });

    return { byStatus: result, total, totalRevenue };
  }),
});
