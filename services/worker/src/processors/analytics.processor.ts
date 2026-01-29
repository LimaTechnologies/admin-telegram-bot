import { Job } from 'bullmq';
import { PostHistory, Campaign, Creative, TelegramGroup, logger, getChatMemberCount } from '@common';

interface AnalyticsData {
  type: 'hourly' | 'daily' | 'best-hours' | 'member-sync';
}

export async function processAnalyticsAggregation(job: Job<AnalyticsData>): Promise<void> {
  const { type } = job.data;

  // Handle special job types
  if (type === 'best-hours') {
    return calculateBestPostingHours();
  }

  if (type === 'member-sync') {
    return syncAllGroupMemberCounts();
  }

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

/**
 * Calculate and update best posting hours for all groups
 */
export async function calculateBestPostingHours(): Promise<void> {
  try {
    // Get posts from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Aggregate by group and hour
    const hourlyStats = await PostHistory.aggregate([
      { $match: { sentAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            groupId: '$groupId',
            hour: { $hour: '$sentAt' },
          },
          postCount: { $sum: 1 },
          totalViews: { $sum: '$metrics.views' },
          totalClicks: { $sum: '$metrics.clicks' },
          totalReactions: { $sum: '$metrics.reactions' },
          avgEngagement: {
            $avg: {
              $add: [
                { $ifNull: ['$metrics.views', 0] },
                { $multiply: [{ $ifNull: ['$metrics.clicks', 0] }, 10] },
                { $multiply: [{ $ifNull: ['$metrics.reactions', 0] }, 5] },
              ],
            },
          },
        },
      },
      { $sort: { '_id.groupId': 1, avgEngagement: -1 } },
    ]);

    // Group results by groupId
    const groupHours = new Map<string, Array<{ hour: number; engagement: number }>>();

    for (const stat of hourlyStats) {
      const groupId = stat._id.groupId.toString();
      const hour = stat._id.hour;
      const engagement = Math.round(stat.avgEngagement * 100) / 100;

      if (!groupHours.has(groupId)) {
        groupHours.set(groupId, []);
      }
      groupHours.get(groupId)!.push({ hour, engagement });
    }

    // Update each group with their best posting hours (top 5)
    let updatedCount = 0;
    for (const [groupId, hours] of groupHours) {
      // Sort by engagement and take top 5
      const bestHours = hours
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 5);

      await TelegramGroup.findByIdAndUpdate(groupId, {
        $set: { bestPostingHours: bestHours },
      });
      updatedCount++;
    }

    logger.info('Best posting hours calculation completed', {
      groupsUpdated: updatedCount,
    });
  } catch (error) {
    logger.error('Best posting hours calculation failed', error);
    throw error;
  }
}

/**
 * Sync member counts for all active groups
 */
export async function syncAllGroupMemberCounts(): Promise<void> {
  try {
    const groups = await TelegramGroup.find({ 'settings.isActive': true })
      .select('_id telegramId name');

    let successCount = 0;
    let errorCount = 0;

    for (const group of groups) {
      try {
        const memberCount = await getChatMemberCount(group.telegramId);

        if (memberCount !== null) {
          await TelegramGroup.findByIdAndUpdate(group._id, {
            $set: {
              'stats.memberCount': memberCount,
              lastSyncAt: new Date(),
            },
          });
          successCount++;
        }

        // Delay to avoid rate limiting (100ms between each call)
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        logger.warn('Failed to sync member count for group', {
          groupId: group._id,
          groupName: group.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        errorCount++;
      }
    }

    logger.info('Group member count sync completed', {
      total: groups.length,
      success: successCount,
      errors: errorCount,
    });
  } catch (error) {
    logger.error('Group member count sync failed', error);
    throw error;
  }
}
