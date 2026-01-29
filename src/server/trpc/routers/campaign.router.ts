import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, operatorProcedure } from '../trpc';
import { withAudit } from '../middleware/audit.middleware';
import {
  Campaign,
  postCampaignMessage,
  postCampaignToAllGroups,
  scheduleCampaignPosts,
  resetRotationState,
} from '@common';

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['onlyfans', 'casino']),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  description: z.string().optional(),
  schedule: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime().optional(),
    dailyCap: z.number().min(1).optional(),
    weeklyCap: z.number().min(1).optional(),
  }),
  targeting: z.object({
    groupIds: z.array(z.string()),
  }),
  creativeIds: z.array(z.string()).min(1),
  modelId: z.string().optional(),
  casinoId: z.string().optional(),
  dealId: z.string().optional(),
});

const updateCampaignSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'active', 'paused', 'scheduled', 'ended']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  description: z.string().optional(),
  schedule: z
    .object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      dailyCap: z.number().min(1).optional(),
      weeklyCap: z.number().min(1).optional(),
    })
    .optional(),
  targeting: z
    .object({
      groupIds: z.array(z.string()).optional(),
    })
    .optional(),
  creativeIds: z.array(z.string()).optional(),
});

export const campaignRouter = router({
  // List campaigns
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        type: z.enum(['onlyfans', 'casino']).optional(),
        status: z.enum(['draft', 'active', 'paused', 'scheduled', 'ended']).optional(),
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

      const [campaigns, total] = await Promise.all([
        Campaign.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('modelId', 'name username')
          .populate('casinoId', 'name brand')
          .populate('dealId', 'name status')
          .select('-__v'),
        Campaign.countDocuments(filter),
      ]);

      return {
        data: campaigns.map((c) => c.toObject()),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  // Get single campaign
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const campaign = await Campaign.findById(input.id)
        .populate('modelId')
        .populate('casinoId')
        .populate('dealId')
        .populate('creativeIds')
        .populate('targeting.groupIds', 'name username type stats.memberCount')
        .select('-__v');

      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }
      return campaign.toObject();
    }),

  // Get all active campaigns (for selection)
  getActive: protectedProcedure.query(async () => {
    const campaigns = await Campaign.find({ status: 'active' })
      .sort({ name: 1 })
      .select('_id name type');
    return campaigns.map((c) => c.toObject());
  }),

  // Create campaign (operator+)
  create: operatorProcedure
    .input(createCampaignSchema)
    .use(
      withAudit({
        action: 'campaign.create',
        entityType: 'campaign',
        getAfter: (_, result) => result,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const campaign = await Campaign.create({
        ...input,
        schedule: {
          ...input.schedule,
          startDate: new Date(input.schedule.startDate),
          endDate: input.schedule.endDate ? new Date(input.schedule.endDate) : undefined,
        },
        createdBy: ctx.session.userId,
      });

      return campaign.toObject();
    }),

  // Update campaign (operator+)
  update: operatorProcedure
    .input(updateCampaignSchema)
    .use(
      withAudit({
        action: 'campaign.update',
        entityType: 'campaign',
        getEntityId: (input) => (input as { id: string }).id,
        getBefore: async (input) => {
          const campaign = await Campaign.findById((input as { id: string }).id);
          return campaign;
        },
        getAfter: (_, result) => result,
      })
    )
    .mutation(async ({ input }) => {
      const { id, schedule, targeting, ...data } = input;

      const updateData: Record<string, unknown> = { ...data };

      if (schedule) {
        Object.entries(schedule).forEach(([key, value]) => {
          if (value !== undefined) {
            updateData[`schedule.${key}`] = key.includes('Date') ? new Date(value as string) : value;
          }
        });
      }

      if (targeting?.groupIds) {
        updateData['targeting.groupIds'] = targeting.groupIds;
      }

      const campaign = await Campaign.findByIdAndUpdate(id, updateData, { new: true })
        .populate('modelId', 'name username')
        .populate('casinoId', 'name brand')
        .select('-__v');

      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }

      return campaign.toObject();
    }),

  // Delete campaign (operator+)
  delete: operatorProcedure
    .input(z.object({ id: z.string() }))
    .use(
      withAudit({
        action: 'campaign.delete',
        entityType: 'campaign',
        getEntityId: (input) => (input as { id: string }).id,
        getBefore: async (input) => {
          const campaign = await Campaign.findById((input as { id: string }).id);
          return campaign;
        },
      })
    )
    .mutation(async ({ input }) => {
      const result = await Campaign.findByIdAndDelete(input.id);
      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }
      return { success: true };
    }),

  // Start campaign
  start: operatorProcedure
    .input(
      z.object({
        id: z.string(),
        postImmediately: z.boolean().default(false),
      })
    )
    .use(
      withAudit({
        action: 'campaign.start',
        entityType: 'campaign',
        getEntityId: (input) => (input as { id: string }).id,
      })
    )
    .mutation(async ({ input }) => {
      const campaign = await Campaign.findByIdAndUpdate(
        input.id,
        { status: 'active' },
        { new: true }
      );
      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }

      // Reset rotation state on campaign start
      resetRotationState(input.id);

      // Optionally trigger immediate posting
      let postingResult;
      if (input.postImmediately) {
        postingResult = await postCampaignToAllGroups(input.id);
      }

      return {
        campaign: campaign.toObject(),
        posting: postingResult,
      };
    }),

  // Pause campaign
  pause: operatorProcedure
    .input(z.object({ id: z.string() }))
    .use(
      withAudit({
        action: 'campaign.pause',
        entityType: 'campaign',
        getEntityId: (input) => (input as { id: string }).id,
      })
    )
    .mutation(async ({ input }) => {
      const campaign = await Campaign.findByIdAndUpdate(
        input.id,
        { status: 'paused' },
        { new: true }
      );
      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }
      return campaign.toObject();
    }),

  // Post one message from campaign (next in rotation)
  postNow: operatorProcedure
    .input(
      z.object({
        id: z.string(),
        groupId: z.string().optional(),
        creativeId: z.string().optional(),
      })
    )
    .use(
      withAudit({
        action: 'post.send',
        entityType: 'campaign',
        getEntityId: (input) => (input as { id: string }).id,
      })
    )
    .mutation(async ({ input }) => {
      const campaign = await Campaign.findById(input.id);
      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }
      if (campaign.status !== 'active') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Campaign must be active to post',
        });
      }

      const result = await postCampaignMessage(input.id, input.groupId, input.creativeId);

      if (!result.success && result.errors.length > 0) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.errors.join(', '),
        });
      }

      return result;
    }),

  // Post to all groups in campaign
  postToAll: operatorProcedure
    .input(z.object({ id: z.string() }))
    .use(
      withAudit({
        action: 'post.send',
        entityType: 'campaign',
        getEntityId: (input) => (input as { id: string }).id,
      })
    )
    .mutation(async ({ input }) => {
      const campaign = await Campaign.findById(input.id);
      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }
      if (campaign.status !== 'active') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Campaign must be active to post',
        });
      }

      const result = await postCampaignToAllGroups(input.id);
      return result;
    }),

  // Schedule campaign posts at intervals
  scheduleInterval: operatorProcedure
    .input(
      z.object({
        id: z.string(),
        intervalMinutes: z.number().min(5).max(1440).default(60),
        totalPosts: z.number().min(1).max(100).default(10),
      })
    )
    .use(
      withAudit({
        action: 'post.schedule',
        entityType: 'campaign',
        getEntityId: (input) => (input as { id: string }).id,
      })
    )
    .mutation(async ({ input }) => {
      const campaign = await Campaign.findById(input.id);
      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }
      if (campaign.status !== 'active') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Campaign must be active to schedule posts',
        });
      }

      const result = await scheduleCampaignPosts(
        input.id,
        input.intervalMinutes,
        input.totalPosts
      );
      return result;
    }),

  // Get campaign stats
  getStats: protectedProcedure.query(async () => {
    const stats = await Campaign.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$performance.totalRevenue' },
          totalPosts: { $sum: '$performance.totalPosts' },
        },
      },
    ]);

    const result = {
      total: 0,
      active: 0,
      paused: 0,
      draft: 0,
      ended: 0,
      totalRevenue: 0,
      totalPosts: 0,
    };

    stats.forEach((s) => {
      result.total += s.count;
      result.totalRevenue += s.totalRevenue;
      result.totalPosts += s.totalPosts;
      if (s._id && s._id in result) {
        (result as Record<string, number>)[s._id] = s.count;
      }
    });

    return result;
  }),
});
