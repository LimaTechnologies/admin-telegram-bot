import type { Job } from 'bullmq';
import {
  logger,
  TelegramGroup,
  getBot,
  discoverAllGroups,
  syncGroupToDatabase,
  getChatDetails,
  getChatMemberCount,
  getBotPermissions,
} from '@common';
import type {
  BotTaskJob,
  SendMessageJobData,
  DeleteMessageJobData,
  SyncGroupJobData,
  GroupSyncResult,
} from '$types/telegram-group';

// Rate limiting: Telegram allows 30 messages per second
const RATE_LIMIT_DELAY_MS = 50; // ~20 req/sec to be safe

interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
  cooldownRemaining?: number;
  adsToday?: number;
  maxAdsPerDay?: number;
}

/**
 * Check if we can send a message to this group based on rate limits
 */
async function checkGroupRateLimit(chatId: string): Promise<RateLimitCheck> {
  const group = await TelegramGroup.findOne({ telegramId: chatId });

  if (!group) {
    // Allow if group not in database (might be a direct chat ID)
    return { allowed: true };
  }

  if (!group.settings?.isActive) {
    return { allowed: false, reason: 'Group is inactive' };
  }

  const now = new Date();
  const settings = group.settings;

  // Check cooldown between messages
  if (group.stats?.lastPostAt && settings?.cooldownMinutes) {
    const lastPost = new Date(group.stats.lastPostAt);
    const cooldownMs = settings.cooldownMinutes * 60 * 1000;
    const timeSinceLastPost = now.getTime() - lastPost.getTime();

    if (timeSinceLastPost < cooldownMs) {
      const remainingMs = cooldownMs - timeSinceLastPost;
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return {
        allowed: false,
        reason: `Cooldown active: ${remainingMinutes} minutes remaining`,
        cooldownRemaining: remainingMinutes,
      };
    }
  }

  // Check maxAdsPerDay limit
  if (settings?.maxAdsPerDay) {
    // Count messages sent today
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    // We track this by counting in a separate collection or using the stats
    // For now, we'll use a simple approach: check if lastPostAt is today
    // and use a counter we'll add to stats
    const todayPostCount = await getPostCountToday(chatId);

    if (todayPostCount >= settings.maxAdsPerDay) {
      return {
        allowed: false,
        reason: `Daily limit reached: ${todayPostCount}/${settings.maxAdsPerDay} ads today`,
        adsToday: todayPostCount,
        maxAdsPerDay: settings.maxAdsPerDay,
      };
    }

    return {
      allowed: true,
      adsToday: todayPostCount,
      maxAdsPerDay: settings.maxAdsPerDay,
    };
  }

  return { allowed: true };
}

/**
 * Get count of posts sent to a group today
 */
async function getPostCountToday(chatId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // We'll track daily posts using a simple counter in a separate field
  // For now, check if we have any tracking mechanism
  const group = await TelegramGroup.findOne({ telegramId: chatId });

  // If lastPostAt is today and we have totalPosts, estimate based on time
  // Better: Add a postsToday field that resets daily
  if (group?.stats?.lastPostAt) {
    const lastPost = new Date(group.stats.lastPostAt);
    if (lastPost >= startOfDay) {
      // We had at least one post today
      // Use the postsToday counter if available
      return (group as unknown as { postsToday?: number }).postsToday || 1;
    }
  }

  return 0;
}

/**
 * Update group statistics after sending a message
 */
async function updateGroupStatsAfterPost(chatId: string): Promise<void> {
  const now = new Date();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const group = await TelegramGroup.findOne({ telegramId: chatId });
  if (!group) return;

  // Check if last post was today to decide whether to increment postsToday or reset
  const lastPostWasToday = group.stats?.lastPostAt &&
    new Date(group.stats.lastPostAt) >= startOfDay;

  if (lastPostWasToday) {
    // Increment both totalPosts and postsToday
    await TelegramGroup.findOneAndUpdate(
      { telegramId: chatId },
      {
        $inc: { 'stats.totalPosts': 1, postsToday: 1 },
        $set: { 'stats.lastPostAt': now },
      }
    );
  } else {
    // Reset postsToday to 1 (first post of the day)
    await TelegramGroup.findOneAndUpdate(
      { telegramId: chatId },
      {
        $inc: { 'stats.totalPosts': 1 },
        $set: { 'stats.lastPostAt': now, postsToday: 1 },
      }
    );
  }

  logger.info('Updated group stats after post', { chatId, totalPosts: (group.stats?.totalPosts || 0) + 1 });
}

/**
 * Process bot tasks queue jobs
 */
export async function processBotTasks(job: Job<BotTaskJob>): Promise<unknown> {
  const { type, data } = job.data;

  logger.info('Processing bot task', { jobId: job.id, type });

  switch (type) {
    case 'sync-groups':
      return await processSyncGroups();

    case 'sync-single-group':
      return await processSyncSingleGroup(data as SyncGroupJobData);

    case 'send-message':
      return await processSendMessage(data as SendMessageJobData);

    case 'delete-message':
      return await processDeleteMessage(data as DeleteMessageJobData);

    case 'get-chat-info':
      return await processGetChatInfo(data as { chatId: string });

    case 'check-permissions':
      return await processCheckPermissions(data as { chatId: string });

    default:
      throw new Error(`Unknown bot task type: ${type}`);
  }
}

/**
 * Sync all groups from database with Telegram
 */
async function processSyncGroups(): Promise<{ results: GroupSyncResult[] }> {
  const results = await discoverAllGroups();
  return { results };
}

/**
 * Sync a single group
 */
async function processSyncSingleGroup(data: SyncGroupJobData): Promise<GroupSyncResult> {
  if (!data.telegramId) {
    throw new Error('telegramId is required');
  }

  await rateLimitDelay();
  return await syncGroupToDatabase(data.telegramId);
}

/**
 * Send a message to a Telegram chat
 */
async function processSendMessage(data: SendMessageJobData): Promise<{
  messageId: number;
  rateLimitInfo?: { adsToday?: number; maxAdsPerDay?: number };
}> {
  if (!data.chatId || !data.text) {
    throw new Error('chatId and text are required');
  }

  // Check rate limits unless explicitly bypassed (for test messages)
  if (!data.bypassRateLimit) {
    const rateLimit = await checkGroupRateLimit(data.chatId);
    if (!rateLimit.allowed) {
      logger.warn('Message blocked by rate limit', {
        chatId: data.chatId,
        reason: rateLimit.reason,
        cooldownRemaining: rateLimit.cooldownRemaining,
        adsToday: rateLimit.adsToday,
      });
      throw new Error(`Rate limit: ${rateLimit.reason}`);
    }
  }

  await rateLimitDelay();

  const bot = await getBot();
  const result = await bot.api.sendMessage(data.chatId, data.text, {
    parse_mode: data.parseMode || 'HTML',
    reply_to_message_id: data.replyToMessageId,
    disable_notification: data.disableNotification,
  });

  // Update lastMessageId in database
  await TelegramGroup.findOneAndUpdate(
    { telegramId: data.chatId },
    { $set: { lastMessageId: result.message_id } }
  );

  // Update group statistics (track posts)
  await updateGroupStatsAfterPost(data.chatId);

  // Get updated rate limit info for response
  const rateLimit = await checkGroupRateLimit(data.chatId);

  logger.info('Message sent via queue', {
    chatId: data.chatId,
    messageId: result.message_id,
    adsToday: rateLimit.adsToday,
    maxAdsPerDay: rateLimit.maxAdsPerDay,
  });

  return {
    messageId: result.message_id,
    rateLimitInfo: {
      adsToday: rateLimit.adsToday,
      maxAdsPerDay: rateLimit.maxAdsPerDay,
    },
  };
}

/**
 * Delete a message from a Telegram chat
 */
async function processDeleteMessage(data: DeleteMessageJobData): Promise<{ success: boolean }> {
  if (!data.chatId || !data.messageId) {
    throw new Error('chatId and messageId are required');
  }

  await rateLimitDelay();

  const bot = await getBot();
  await bot.api.deleteMessage(data.chatId, data.messageId);

  logger.info('Message deleted via queue', {
    chatId: data.chatId,
    messageId: data.messageId,
  });

  return { success: true };
}

/**
 * Get chat information
 */
async function processGetChatInfo(data: { chatId: string }): Promise<{
  title: string;
  username?: string;
  memberCount: number;
  type: string;
  description?: string;
}> {
  if (!data.chatId) {
    throw new Error('chatId is required');
  }

  await rateLimitDelay();

  const chat = await getChatDetails(data.chatId);
  if (!chat) {
    throw new Error('Could not get chat details');
  }

  const memberCount = await getChatMemberCount(data.chatId);

  return {
    title: 'title' in chat ? chat.title : 'Unknown',
    username: 'username' in chat ? chat.username : undefined,
    memberCount,
    type: chat.type,
    description: 'description' in chat ? chat.description : undefined,
  };
}

/**
 * Check bot permissions in a chat
 */
async function processCheckPermissions(data: { chatId: string }): Promise<{
  isAdmin: boolean;
  permissions: Record<string, boolean> | null;
}> {
  if (!data.chatId) {
    throw new Error('chatId is required');
  }

  await rateLimitDelay();

  const permissions = await getBotPermissions(data.chatId);

  return {
    isAdmin: permissions !== null,
    permissions,
  };
}

/**
 * Rate limit delay to avoid hitting Telegram API limits
 */
async function rateLimitDelay(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
}
