import { Job } from 'bullmq';
import {
  ScheduledPost,
  PostHistory,
  Campaign,
  Creative,
  TelegramGroup,
  getSettings,
  logger,
} from '@common';
import { sendTelegramMessage } from '../../bot/src/services/poster.service';

interface PostJobData {
  scheduledPostId: string;
}

export async function processScheduledPost(job: Job<PostJobData>): Promise<void> {
  const startTime = Date.now();
  const { scheduledPostId } = job.data;

  // Get the scheduled post
  const scheduledPost = await ScheduledPost.findById(scheduledPostId);
  if (!scheduledPost) {
    logger.warn('Scheduled post not found', { scheduledPostId });
    return;
  }

  // Check if already processed
  if (scheduledPost.status !== 'queued' && scheduledPost.status !== 'pending') {
    logger.debug('Post already processed', { scheduledPostId, status: scheduledPost.status });
    return;
  }

  // Check emergency stop
  const settings = await getSettings();
  if (settings.spamControl.emergencyStopActive) {
    logger.warn('Emergency stop active, skipping post', { scheduledPostId });
    scheduledPost.status = 'cancelled';
    scheduledPost.lastError = 'Emergency stop active';
    await scheduledPost.save();
    return;
  }

  // Mark as processing
  scheduledPost.status = 'processing';
  scheduledPost.attempts += 1;
  await scheduledPost.save();

  try {
    // Get related entities
    const [creative, group] = await Promise.all([
      Creative.findById(scheduledPost.creativeId),
      TelegramGroup.findById(scheduledPost.groupId),
    ]);

    if (!creative || !group) {
      throw new Error('Creative or group not found');
    }

    // Check group is active
    if (!group.settings.isActive) {
      throw new Error('Group is not active');
    }

    // Send the message
    const result = await sendTelegramMessage({
      groupId: group.telegramId,
      creative: {
        mediaType: creative.media.type,
        mediaUrl: creative.media.url,
        caption: creative.caption,
        ctaUrl: creative.ctaUrl,
      },
    });

    const processingTime = Date.now() - startTime;

    // Update scheduled post
    scheduledPost.status = 'sent';
    scheduledPost.sentAt = new Date();
    scheduledPost.messageId = result.messageId;
    await scheduledPost.save();

    // Create post history
    await PostHistory.create({
      scheduledPostId: scheduledPost._id,
      campaignId: scheduledPost.campaignId,
      creativeId: scheduledPost.creativeId,
      groupId: scheduledPost.groupId,
      messageId: result.messageId,
      sentAt: new Date(),
      processingTimeMs: processingTime,
    });

    // Update group stats
    await TelegramGroup.findByIdAndUpdate(scheduledPost.groupId, {
      $inc: { 'stats.totalPosts': 1 },
      $set: { 'stats.lastPostAt': new Date() },
    });

    // Update campaign stats
    await Campaign.findByIdAndUpdate(scheduledPost.campaignId, {
      $inc: { 'performance.totalPosts': 1 },
    });

    // Update creative stats
    await Creative.findByIdAndUpdate(scheduledPost.creativeId, {
      $inc: { 'performance.timesUsed': 1 },
    });

    logger.info('Post sent successfully', {
      scheduledPostId,
      groupId: group.telegramId,
      messageId: result.messageId,
      processingTime,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    scheduledPost.status = 'failed';
    scheduledPost.lastError = errorMessage;
    await scheduledPost.save();

    logger.error('Failed to send post', error, { scheduledPostId });
    throw error;
  }
}
