import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, operatorProcedure } from '../trpc';
import { withAudit } from '../middleware/audit.middleware';
import { ScheduledPost, Campaign, Creative, TelegramGroup } from '@common';

const createScheduledPostSchema = z.object({
  campaignId: z.string(),
  creativeId: z.string(),
  groupId: z.string(),
  scheduledFor: z.string().datetime(),
  scheduleType: z.enum(['fixed', 'smart', 'randomized']).default('fixed'),
  priority: z.number().default(0),
});

const updateScheduledPostSchema = z.object({
  id: z.string(),
  scheduledFor: z.string().datetime().optional(),
  scheduleType: z.enum(['fixed', 'smart', 'randomized']).optional(),
  status: z.enum(['pending', 'queued', 'processing', 'sent', 'failed', 'cancelled']).optional(),
  priority: z.number().optional(),
});

export const scheduledPostRouter = router({
  // List scheduled posts
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        status: z.enum(['pending', 'queued', 'processing', 'sent', 'failed', 'cancelled']).optional(),
        groupId: z.string().optional(),
        campaignId: z.string().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
    )
    .query(async ({ input }) => {
      const { page, limit, status, groupId, campaignId, from, to } = input;

      const filter: Record<string, unknown> = {};
      if (status) filter['status'] = status;
      if (groupId) filter['groupId'] = groupId;
      if (campaignId) filter['campaignId'] = campaignId;
      if (from || to) {
        filter['scheduledFor'] = {};
        if (from) (filter['scheduledFor'] as Record<string, unknown>)['$gte'] = new Date(from);
        if (to) (filter['scheduledFor'] as Record<string, unknown>)['$lte'] = new Date(to);
      }

      const [posts, total] = await Promise.all([
        ScheduledPost.find(filter)
          .sort({ scheduledFor: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('campaignId', 'name type')
          .populate('creativeId', 'name type')
          .populate('groupId', 'name')
          .select('-__v'),
        ScheduledPost.countDocuments(filter),
      ]);

      return {
        data: posts.map((p) => p.toObject()),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  // Get single scheduled post
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const post = await ScheduledPost.findById(input.id)
        .populate('campaignId')
        .populate('creativeId')
        .populate('groupId')
        .select('-__v');

      if (!post) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Scheduled post not found' });
      }
      return post.toObject();
    }),

  // Create scheduled post (operator+)
  create: operatorProcedure
    .input(createScheduledPostSchema)
    .use(
      withAudit({
        action: 'post.create',
        entityType: 'post',
        getAfter: (_, result) => result,
      })
    )
    .mutation(async ({ input }) => {
      // Validate references exist
      const [campaign, creative, group] = await Promise.all([
        Campaign.findById(input.campaignId),
        Creative.findById(input.creativeId),
        TelegramGroup.findById(input.groupId),
      ]);

      if (!campaign) throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      if (!creative) throw new TRPCError({ code: 'NOT_FOUND', message: 'Creative not found' });
      if (!group) throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });

      const post = await ScheduledPost.create({
        ...input,
        scheduledFor: new Date(input.scheduledFor),
      });

      return post.toObject();
    }),

  // Update scheduled post (operator+)
  update: operatorProcedure
    .input(updateScheduledPostSchema)
    .use(
      withAudit({
        action: 'post.update',
        entityType: 'post',
        getEntityId: (input) => (input as { id: string }).id,
        getBefore: async (input) => {
          const post = await ScheduledPost.findById((input as { id: string }).id);
          return post;
        },
        getAfter: (_, result) => result,
      })
    )
    .mutation(async ({ input }) => {
      const { id, scheduledFor, ...data } = input;

      const updateData: Record<string, unknown> = { ...data };
      if (scheduledFor) updateData['scheduledFor'] = new Date(scheduledFor);

      const post = await ScheduledPost.findByIdAndUpdate(id, updateData, { new: true })
        .populate('campaignId', 'name type')
        .populate('creativeId', 'name type')
        .populate('groupId', 'name')
        .select('-__v');

      if (!post) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Scheduled post not found' });
      }

      return post.toObject();
    }),

  // Delete scheduled post (operator+)
  delete: operatorProcedure
    .input(z.object({ id: z.string() }))
    .use(
      withAudit({
        action: 'post.delete',
        entityType: 'post',
        getEntityId: (input) => (input as { id: string }).id,
        getBefore: async (input) => {
          const post = await ScheduledPost.findById((input as { id: string }).id);
          return post;
        },
      })
    )
    .mutation(async ({ input }) => {
      const result = await ScheduledPost.findByIdAndDelete(input.id);
      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Scheduled post not found' });
      }
      return { success: true };
    }),

  // Get stats for today/week
  getStats: protectedProcedure.query(async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [todayCount, weekCount, pendingApproval, conflicts] = await Promise.all([
      ScheduledPost.countDocuments({
        scheduledFor: { $gte: todayStart, $lt: todayEnd },
        status: { $in: ['pending', 'queued'] },
      }),
      ScheduledPost.countDocuments({
        scheduledFor: { $gte: todayStart, $lt: weekEnd },
        status: { $in: ['pending', 'queued'] },
      }),
      ScheduledPost.countDocuments({ status: 'pending' }),
      // Simplified conflict check - posts within 30 min of each other
      0, // Would need aggregation for real conflict detection
    ]);

    return {
      today: todayCount,
      week: weekCount,
      pendingApproval,
      conflicts,
    };
  }),
});
