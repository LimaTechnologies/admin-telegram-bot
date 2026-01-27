import { Job } from 'bullmq';
import { Campaign, ScheduledPost, logger } from '@common';

interface CampaignCheckData {
  type: 'status_check' | 'schedule_posts';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function processCampaignCheck(job: Job<CampaignCheckData>): Promise<void> {
  const now = new Date();

  try {
    // Find campaigns that should start
    const campaignsToStart = await Campaign.find({
      status: 'scheduled',
      'schedule.startDate': { $lte: now },
    });

    for (const campaign of campaignsToStart) {
      campaign.status = 'active';
      await campaign.save();
      logger.info('Campaign auto-started', { campaignId: campaign._id.toString() });
    }

    // Find campaigns that should end
    const campaignsToEnd = await Campaign.find({
      status: 'active',
      'schedule.endDate': { $lte: now },
    });

    for (const campaign of campaignsToEnd) {
      campaign.status = 'ended';
      await campaign.save();
      logger.info('Campaign auto-ended', { campaignId: campaign._id.toString() });

      // Cancel any pending posts
      await ScheduledPost.updateMany(
        {
          campaignId: campaign._id,
          status: { $in: ['pending', 'queued'] },
        },
        {
          status: 'cancelled',
          lastError: 'Campaign ended',
        }
      );
    }

    // Check daily caps
    const activeCampaigns = await Campaign.find({
      status: 'active',
      'schedule.dailyCap': { $exists: true, $gt: 0 },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (const campaign of activeCampaigns) {
      const todayPostsCount = await ScheduledPost.countDocuments({
        campaignId: campaign._id,
        status: 'sent',
        sentAt: { $gte: todayStart },
      });

      if (campaign.schedule.dailyCap && todayPostsCount >= campaign.schedule.dailyCap) {
        // Cancel remaining posts for today
        await ScheduledPost.updateMany(
          {
            campaignId: campaign._id,
            status: { $in: ['pending', 'queued'] },
            scheduledFor: {
              $gte: todayStart,
              $lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000),
            },
          },
          {
            status: 'cancelled',
            lastError: 'Daily cap reached',
          }
        );

        logger.info('Campaign daily cap reached', {
          campaignId: campaign._id.toString(),
          cap: campaign.schedule.dailyCap,
          sent: todayPostsCount,
        });
      }
    }

    logger.debug('Campaign check completed', {
      started: campaignsToStart.length,
      ended: campaignsToEnd.length,
    });
  } catch (error) {
    logger.error('Campaign check failed', error);
    throw error;
  }
}
