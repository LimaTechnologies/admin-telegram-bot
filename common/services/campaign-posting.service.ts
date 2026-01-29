import { Campaign, TelegramGroup, botTasksQueue, logger } from '@common';
import type { BotTaskJob } from '$types/telegram-group';

interface PostingResult {
  success: boolean;
  jobsQueued: number;
  errors: string[];
  details: Array<{
    groupId: string;
    groupName: string;
    creativeId: string;
    creativeName: string;
    jobId: string | undefined;
    error?: string;
  }>;
}

interface RotationState {
  lastGroupIndex: number;
  lastCreativeIndex: number;
}

// In-memory rotation state (could be moved to Redis for persistence)
const rotationStates = new Map<string, RotationState>();

/**
 * Get the next group in rotation for a campaign
 */
function getNextGroupIndex(campaignId: string, totalGroups: number): number {
  const state = rotationStates.get(campaignId) || { lastGroupIndex: -1, lastCreativeIndex: -1 };
  const nextIndex = (state.lastGroupIndex + 1) % totalGroups;
  state.lastGroupIndex = nextIndex;
  rotationStates.set(campaignId, state);
  return nextIndex;
}

/**
 * Get the next creative in rotation for a campaign
 */
function getNextCreativeIndex(campaignId: string, totalCreatives: number): number {
  const state = rotationStates.get(campaignId) || { lastGroupIndex: -1, lastCreativeIndex: -1 };
  const nextIndex = (state.lastCreativeIndex + 1) % totalCreatives;
  state.lastCreativeIndex = nextIndex;
  rotationStates.set(campaignId, state);
  return nextIndex;
}

/**
 * Check if a group can receive a new ad based on limits
 */
async function canGroupReceiveAd(groupId: string): Promise<{ canPost: boolean; reason?: string }> {
  const group = await TelegramGroup.findById(groupId);
  if (!group) {
    return { canPost: false, reason: 'Group not found' };
  }

  if (!group.settings.isActive) {
    return { canPost: false, reason: 'Group is inactive' };
  }

  // Check maxAdsPerDay
  const postsToday = group.postsToday || 0;
  if (postsToday >= group.settings.maxAdsPerDay) {
    return { canPost: false, reason: `Daily limit reached (${postsToday}/${group.settings.maxAdsPerDay})` };
  }

  // Check cooldown
  if (group.stats.lastPostAt) {
    const lastPostTime = new Date(group.stats.lastPostAt).getTime();
    const cooldownMs = group.settings.cooldownMinutes * 60 * 1000;
    const timeSinceLastPost = Date.now() - lastPostTime;

    if (timeSinceLastPost < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - timeSinceLastPost) / 60000);
      return { canPost: false, reason: `Cooldown active (${remainingMinutes}min remaining)` };
    }
  }

  return { canPost: true };
}

/**
 * Build message content from a creative
 */
function buildMessageContent(creative: {
  caption: string;
  ctaText?: string;
  ctaUrl?: string;
}): string {
  let content = creative.caption;

  if (creative.ctaText && creative.ctaUrl) {
    content += `\n\n<a href="${creative.ctaUrl}">${creative.ctaText}</a>`;
  } else if (creative.ctaUrl) {
    content += `\n\n${creative.ctaUrl}`;
  }

  return content;
}

/**
 * Post a single message from a campaign to a specific group
 */
export async function postCampaignMessage(
  campaignId: string,
  groupId?: string,
  creativeId?: string
): Promise<PostingResult> {
  const result: PostingResult = {
    success: false,
    jobsQueued: 0,
    errors: [],
    details: [],
  };

  try {
    // Get campaign with populated fields
    const campaign = await Campaign.findById(campaignId)
      .populate('targeting.groupIds')
      .populate('creativeIds');

    if (!campaign) {
      result.errors.push('Campaign not found');
      return result;
    }

    if (campaign.status !== 'active') {
      result.errors.push(`Campaign is not active (status: ${campaign.status})`);
      return result;
    }

    const groups = campaign.targeting.groupIds as unknown as Array<{
      _id: string;
      telegramId: string;
      name: string;
    }>;
    const creatives = campaign.creativeIds as unknown as Array<{
      _id: string;
      name: string;
      caption: string;
      ctaText?: string;
      ctaUrl?: string;
    }>;

    if (groups.length === 0) {
      result.errors.push('No groups targeted');
      return result;
    }

    if (creatives.length === 0) {
      result.errors.push('No creatives assigned');
      return result;
    }

    // Select group (specific or next in rotation)
    let selectedGroup;
    if (groupId) {
      selectedGroup = groups.find((g) => g._id.toString() === groupId);
      if (!selectedGroup) {
        result.errors.push('Specified group not in campaign targets');
        return result;
      }
    } else {
      const groupIndex = getNextGroupIndex(campaignId, groups.length);
      selectedGroup = groups[groupIndex];
    }

    // Select creative (specific or next in rotation)
    let selectedCreative;
    if (creativeId) {
      selectedCreative = creatives.find((c) => c._id.toString() === creativeId);
      if (!selectedCreative) {
        result.errors.push('Specified creative not in campaign');
        return result;
      }
    } else {
      const creativeIndex = getNextCreativeIndex(campaignId, creatives.length);
      selectedCreative = creatives[creativeIndex];
    }

    // Check if group can receive ad
    const canPost = await canGroupReceiveAd(selectedGroup._id.toString());
    if (!canPost.canPost) {
      result.details.push({
        groupId: selectedGroup._id.toString(),
        groupName: selectedGroup.name,
        creativeId: selectedCreative._id.toString(),
        creativeName: selectedCreative.name,
        jobId: undefined,
        error: canPost.reason,
      });
      result.errors.push(`Cannot post to ${selectedGroup.name}: ${canPost.reason}`);
      return result;
    }

    // Build message and enqueue
    const messageContent = buildMessageContent(selectedCreative);
    const jobData: BotTaskJob = {
      type: 'send-message',
      data: {
        chatId: selectedGroup.telegramId,
        text: messageContent,
        parseMode: 'HTML',
        campaignId: campaignId,
        creativeId: selectedCreative._id.toString(),
      },
    };

    const job = await botTasksQueue.add('campaign-post', jobData, {
      priority: campaign.priority === 'high' ? 1 : campaign.priority === 'medium' ? 2 : 3,
    });

    result.details.push({
      groupId: selectedGroup._id.toString(),
      groupName: selectedGroup.name,
      creativeId: selectedCreative._id.toString(),
      creativeName: selectedCreative.name,
      jobId: job.id,
    });
    result.jobsQueued = 1;
    result.success = true;

    logger.info('Campaign message queued', {
      campaignId,
      groupName: selectedGroup.name,
      creativeName: selectedCreative.name,
      jobId: job.id,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMessage);
    logger.error('Failed to queue campaign message', error, { campaignId });
  }

  return result;
}

/**
 * Post to all groups in a campaign (one creative per group with rotation)
 */
export async function postCampaignToAllGroups(campaignId: string): Promise<PostingResult> {
  const result: PostingResult = {
    success: false,
    jobsQueued: 0,
    errors: [],
    details: [],
  };

  try {
    const campaign = await Campaign.findById(campaignId)
      .populate('targeting.groupIds')
      .populate('creativeIds');

    if (!campaign) {
      result.errors.push('Campaign not found');
      return result;
    }

    if (campaign.status !== 'active') {
      result.errors.push(`Campaign is not active (status: ${campaign.status})`);
      return result;
    }

    const groups = campaign.targeting.groupIds as unknown as Array<{
      _id: string;
      telegramId: string;
      name: string;
    }>;
    const creatives = campaign.creativeIds as unknown as Array<{
      _id: string;
      name: string;
      caption: string;
      ctaText?: string;
      ctaUrl?: string;
    }>;

    if (groups.length === 0 || creatives.length === 0) {
      result.errors.push('No groups or creatives configured');
      return result;
    }

    // Post to each group with creative rotation
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const creativeIndex = i % creatives.length; // Rotate creatives
      const creative = creatives[creativeIndex];

      // Check group limits
      const canPost = await canGroupReceiveAd(group._id.toString());
      if (!canPost.canPost) {
        result.details.push({
          groupId: group._id.toString(),
          groupName: group.name,
          creativeId: creative._id.toString(),
          creativeName: creative.name,
          jobId: undefined,
          error: canPost.reason,
        });
        continue;
      }

      // Build and enqueue message
      const messageContent = buildMessageContent(creative);
      const jobData: BotTaskJob = {
        type: 'send-message',
        data: {
          chatId: group.telegramId,
          text: messageContent,
          parseMode: 'HTML',
          campaignId: campaignId,
          creativeId: creative._id.toString(),
        },
      };

      // Add delay between messages (5 seconds per group to avoid rate limits)
      const job = await botTasksQueue.add('campaign-post', jobData, {
        priority: campaign.priority === 'high' ? 1 : campaign.priority === 'medium' ? 2 : 3,
        delay: i * 5000, // Stagger by 5 seconds
      });

      result.details.push({
        groupId: group._id.toString(),
        groupName: group.name,
        creativeId: creative._id.toString(),
        creativeName: creative.name,
        jobId: job.id,
      });
      result.jobsQueued++;
    }

    result.success = result.jobsQueued > 0;

    logger.info('Campaign batch queued', {
      campaignId,
      jobsQueued: result.jobsQueued,
      totalGroups: groups.length,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMessage);
    logger.error('Failed to queue campaign batch', error, { campaignId });
  }

  return result;
}

/**
 * Schedule campaign posts at intervals
 */
export async function scheduleCampaignPosts(
  campaignId: string,
  intervalMinutes: number,
  totalPosts: number
): Promise<PostingResult> {
  const result: PostingResult = {
    success: false,
    jobsQueued: 0,
    errors: [],
    details: [],
  };

  try {
    const campaign = await Campaign.findById(campaignId)
      .populate('targeting.groupIds')
      .populate('creativeIds');

    if (!campaign) {
      result.errors.push('Campaign not found');
      return result;
    }

    const groups = campaign.targeting.groupIds as unknown as Array<{
      _id: string;
      telegramId: string;
      name: string;
    }>;
    const creatives = campaign.creativeIds as unknown as Array<{
      _id: string;
      name: string;
      caption: string;
      ctaText?: string;
      ctaUrl?: string;
    }>;

    if (groups.length === 0 || creatives.length === 0) {
      result.errors.push('No groups or creatives configured');
      return result;
    }

    const intervalMs = intervalMinutes * 60 * 1000;

    for (let i = 0; i < totalPosts; i++) {
      const groupIndex = i % groups.length;
      const creativeIndex = i % creatives.length;
      const group = groups[groupIndex];
      const creative = creatives[creativeIndex];

      const messageContent = buildMessageContent(creative);
      const jobData: BotTaskJob = {
        type: 'send-message',
        data: {
          chatId: group.telegramId,
          text: messageContent,
          parseMode: 'HTML',
          campaignId: campaignId,
          creativeId: creative._id.toString(),
        },
      };

      const job = await botTasksQueue.add('scheduled-campaign-post', jobData, {
        priority: campaign.priority === 'high' ? 1 : campaign.priority === 'medium' ? 2 : 3,
        delay: i * intervalMs,
      });

      result.details.push({
        groupId: group._id.toString(),
        groupName: group.name,
        creativeId: creative._id.toString(),
        creativeName: creative.name,
        jobId: job.id,
      });
      result.jobsQueued++;
    }

    result.success = result.jobsQueued > 0;

    logger.info('Campaign scheduled posts queued', {
      campaignId,
      totalPosts,
      intervalMinutes,
      jobsQueued: result.jobsQueued,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMessage);
    logger.error('Failed to schedule campaign posts', error, { campaignId });
  }

  return result;
}

/**
 * Reset rotation state for a campaign
 */
export function resetRotationState(campaignId: string): void {
  rotationStates.delete(campaignId);
}

/**
 * Get current rotation state for a campaign
 */
export function getRotationState(campaignId: string): RotationState | undefined {
  return rotationStates.get(campaignId);
}
