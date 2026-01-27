import { Job } from 'bullmq';
import { PostHistory, Campaign, Creative, TelegramGroup, logger } from '@common';

interface AnalyticsData {
  type: 'hourly' | 'daily';
}

export async function processAnalyticsAggregation(job: Job<AnalyticsData>): Promise<void> {
  const { type } = job.data;

  try {
    const now = new Date();
    let startDate: Date;

    if (type === 'hourly') {
      startDate = new Date(now.getTime() - 60 * 60 * 1000);
    } else {
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Aggregate campaign performance
    const campaignStats = await PostHistory.aggregate([
      { $match: { sentAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$campaignId',
          totalPosts: { $sum: 1 },
          totalViews: { $sum: '$metrics.views' },
          totalClicks: { $sum: '$metrics.clicks' },
          totalRevenue: { $sum: '$revenue' },
        },
      },
    ]);

    for (const stat of campaignStats) {
      const ctr = stat.totalViews > 0 ? (stat.totalClicks / stat.totalViews) * 100 : 0;
      const engagement = stat.totalViews > 0 ? ((stat.totalClicks + stat.totalViews) / stat.totalViews) * 100 : 0;

      await Campaign.findByIdAndUpdate(stat._id, {
        $inc: {
          'performance.totalPosts': stat.totalPosts,
          'performance.totalViews': stat.totalViews,
          'performance.totalClicks': stat.totalClicks,
          'performance.totalRevenue': stat.totalRevenue,
        },
        $set: {
          'performance.ctr': ctr,
          'performance.engagement': engagement,
        },
      });
    }

    // Aggregate creative performance
    const creativeStats = await PostHistory.aggregate([
      { $match: { sentAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$creativeId',
          timesUsed: { $sum: 1 },
          totalViews: { $sum: '$metrics.views' },
          totalClicks: { $sum: '$metrics.clicks' },
          avgEngagement: {
            $avg: {
              $add: ['$metrics.reactions', '$metrics.replies'],
            },
          },
        },
      },
    ]);

    for (const stat of creativeStats) {
      const ctr = stat.totalViews > 0 ? (stat.totalClicks / stat.totalViews) * 100 : 0;

      // Calculate performance score (0-100)
      const performanceScore = Math.min(100, Math.round(ctr * 10 + stat.avgEngagement * 5));

      await Creative.findByIdAndUpdate(stat._id, {
        $inc: {
          'performance.timesUsed': stat.timesUsed,
          'performance.totalViews': stat.totalViews,
          'performance.totalClicks': stat.totalClicks,
        },
        $set: {
          'performance.ctr': ctr,
          'performance.avgEngagement': stat.avgEngagement,
          'performance.performanceScore': performanceScore,
        },
      });
    }

    // Aggregate group performance
    const groupStats = await PostHistory.aggregate([
      { $match: { sentAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$groupId',
          totalPosts: { $sum: 1 },
          totalViews: { $sum: '$metrics.views' },
          avgEngagement: {
            $avg: {
              $add: ['$metrics.reactions', '$metrics.replies'],
            },
          },
        },
      },
    ]);

    for (const stat of groupStats) {
      await TelegramGroup.findByIdAndUpdate(stat._id, {
        $inc: {
          'stats.totalPosts': stat.totalPosts,
          'stats.totalViews': stat.totalViews,
        },
        $set: {
          'stats.avgEngagement': stat.avgEngagement,
        },
      });
    }

    logger.info('Analytics aggregation completed', {
      type,
      campaigns: campaignStats.length,
      creatives: creativeStats.length,
      groups: groupStats.length,
    });
  } catch (error) {
    logger.error('Analytics aggregation failed', error);
    throw error;
  }
}
