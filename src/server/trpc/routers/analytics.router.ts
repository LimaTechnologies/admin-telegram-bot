import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { PostHistory, Campaign, TelegramGroup, Deal } from '@common';

export const analyticsRouter = router({
  // Get overview stats
  getOverview: protectedProcedure
    .input(
      z.object({
        period: z.enum(['today', '7d', '30d', 'all']).default('7d'),
      })
    )
    .query(async ({ input }) => {
      const now = new Date();
      let startDate: Date;

      switch (input.period) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }

      const [postsStats, campaignStats, groupStats, dealStats] = await Promise.all([
        // Posts aggregation
        PostHistory.aggregate([
          { $match: { sentAt: { $gte: startDate } } },
          {
            $group: {
              _id: null,
              totalPosts: { $sum: 1 },
              totalViews: { $sum: '$metrics.views' },
              totalClicks: { $sum: '$metrics.clicks' },
              totalReactions: { $sum: '$metrics.reactions' },
              totalRevenue: { $sum: '$revenue' },
            },
          },
        ]),

        // Campaign stats
        Campaign.aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ]),

        // Group stats
        TelegramGroup.aggregate([
          {
            $group: {
              _id: null,
              totalGroups: { $sum: 1 },
              activeGroups: {
                $sum: { $cond: ['$settings.isActive', 1, 0] },
              },
              totalMembers: { $sum: '$stats.memberCount' },
            },
          },
        ]),

        // Deal stats
        Deal.aggregate([
          { $match: { status: 'active' } },
          {
            $group: {
              _id: null,
              activeDeals: { $sum: 1 },
              expectedRevenue: { $sum: '$performance.expectedRevenue' },
            },
          },
        ]),
      ]);

      const posts = postsStats[0] || { totalPosts: 0, totalViews: 0, totalClicks: 0, totalReactions: 0, totalRevenue: 0 };
      const campaigns = {
        active: 0,
        paused: 0,
        draft: 0,
        scheduled: 0,
        ended: 0,
        total: 0,
      };
      campaignStats.forEach((s) => {
        if (s._id && s._id in campaigns) {
          (campaigns as Record<string, number>)[s._id] = s.count;
        }
        campaigns.total += s.count;
      });

      const groups = groupStats[0] || { totalGroups: 0, activeGroups: 0, totalMembers: 0 };
      const deals = dealStats[0] || { activeDeals: 0, expectedRevenue: 0 };

      // Calculate CTR
      const ctr = posts.totalViews > 0 ? (posts.totalClicks / posts.totalViews) * 100 : 0;

      return {
        posts: {
          ...posts,
          ctr: Math.round(ctr * 100) / 100,
        },
        campaigns,
        groups,
        deals,
      };
    }),

  // Get revenue trend
  getRevenueTrend: protectedProcedure
    .input(
      z.object({
        period: z.enum(['7d', '30d', '90d']).default('30d'),
        groupBy: z.enum(['day', 'week']).default('day'),
      })
    )
    .query(async ({ input }) => {
      const now = new Date();
      const days = input.period === '7d' ? 7 : input.period === '30d' ? 30 : 90;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const groupByFormat = input.groupBy === 'day'
        ? { $dateToString: { format: '%Y-%m-%d', date: '$sentAt' } }
        : {
            $dateToString: {
              format: '%Y-W%V',
              date: '$sentAt',
            },
          };

      const trend = await PostHistory.aggregate([
        { $match: { sentAt: { $gte: startDate } } },
        {
          $group: {
            _id: groupByFormat,
            revenue: { $sum: '$revenue' },
            posts: { $sum: 1 },
            views: { $sum: '$metrics.views' },
            clicks: { $sum: '$metrics.clicks' },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return trend;
    }),

  // Get performance by group
  getPerformanceByGroup: protectedProcedure
    .input(
      z.object({
        period: z.enum(['7d', '30d', '90d']).default('30d'),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const now = new Date();
      const days = input.period === '7d' ? 7 : input.period === '30d' ? 30 : 90;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const performance = await PostHistory.aggregate([
        { $match: { sentAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$groupId',
            posts: { $sum: 1 },
            views: { $sum: '$metrics.views' },
            clicks: { $sum: '$metrics.clicks' },
            revenue: { $sum: '$revenue' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: input.limit },
        {
          $lookup: {
            from: 'telegram_groups',
            localField: '_id',
            foreignField: '_id',
            as: 'group',
          },
        },
        { $unwind: '$group' },
        {
          $project: {
            _id: 1,
            name: '$group.name',
            username: '$group.username',
            posts: 1,
            views: 1,
            clicks: 1,
            revenue: 1,
            ctr: {
              $cond: [
                { $gt: ['$views', 0] },
                { $multiply: [{ $divide: ['$clicks', '$views'] }, 100] },
                0,
              ],
            },
          },
        },
      ]);

      return performance;
    }),

  // Get performance by campaign
  getPerformanceByCampaign: protectedProcedure
    .input(
      z.object({
        period: z.enum(['7d', '30d', '90d']).default('30d'),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const now = new Date();
      const days = input.period === '7d' ? 7 : input.period === '30d' ? 30 : 90;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const performance = await PostHistory.aggregate([
        { $match: { sentAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$campaignId',
            posts: { $sum: 1 },
            views: { $sum: '$metrics.views' },
            clicks: { $sum: '$metrics.clicks' },
            revenue: { $sum: '$revenue' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: input.limit },
        {
          $lookup: {
            from: 'campaigns',
            localField: '_id',
            foreignField: '_id',
            as: 'campaign',
          },
        },
        { $unwind: '$campaign' },
        {
          $project: {
            _id: 1,
            name: '$campaign.name',
            type: '$campaign.type',
            status: '$campaign.status',
            posts: 1,
            views: 1,
            clicks: 1,
            revenue: 1,
            ctr: {
              $cond: [
                { $gt: ['$views', 0] },
                { $multiply: [{ $divide: ['$clicks', '$views'] }, 100] },
                0,
              ],
            },
          },
        },
      ]);

      return performance;
    }),

  // Get hourly activity heatmap
  getHourlyActivity: protectedProcedure
    .input(
      z.object({
        period: z.enum(['7d', '30d']).default('7d'),
      })
    )
    .query(async ({ input }) => {
      const now = new Date();
      const days = input.period === '7d' ? 7 : 30;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const activity = await PostHistory.aggregate([
        { $match: { sentAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              dayOfWeek: { $dayOfWeek: '$sentAt' },
              hour: { $hour: '$sentAt' },
            },
            posts: { $sum: 1 },
            engagement: { $avg: { $add: ['$metrics.reactions', '$metrics.replies'] } },
          },
        },
        { $sort: { '_id.dayOfWeek': 1, '_id.hour': 1 } },
      ]);

      return activity;
    }),
});
