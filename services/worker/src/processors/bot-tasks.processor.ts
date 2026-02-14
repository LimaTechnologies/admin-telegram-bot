import type { Job } from 'bullmq';
import { GrammyError, HttpError } from 'grammy';
import {
  logger,
  TelegramGroup,
  PostHistory,
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
  DeleteMessagesBulkJobData,
  ClearAllMessagesJobData,
  SyncGroupJobData,
  GroupSyncResult,
} from '$types/telegram-group';

// Rate limiting: Telegram allows 30 messages per second
const RATE_LIMIT_DELAY_MS = 50; // ~20 req/sec to be safe

/**
 * Telegram API Error Codes
 */
const TELEGRAM_ERRORS = {
  // Recoverable errors (retry with backoff)
  TOO_MANY_REQUESTS: 429,
  FLOOD_WAIT: 420,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,

  // Permission/access errors (don't retry)
  BOT_BLOCKED: 403,
  CHAT_NOT_FOUND: 400,
  USER_DEACTIVATED: 403,
  BOT_KICKED: 403,
  CHAT_WRITE_FORBIDDEN: 403,

  // Invalid request errors (don't retry)
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
} as const;

/**
 * Classify Telegram API errors
 */
interface TelegramErrorInfo {
  isRecoverable: boolean;
  shouldDeactivateGroup: boolean;
  retryAfter?: number;
  errorType: string;
  message: string;
}

function classifyTelegramError(error: unknown): TelegramErrorInfo {
  // Default error info
  const defaultInfo: TelegramErrorInfo = {
    isRecoverable: false,
    shouldDeactivateGroup: false,
    errorType: 'UNKNOWN',
    message: error instanceof Error ? error.message : 'Unknown error',
  };

  if (error instanceof GrammyError) {
    const description = error.description.toLowerCase();

    // Rate limiting - recoverable with retry
    if (error.error_code === TELEGRAM_ERRORS.TOO_MANY_REQUESTS ||
        description.includes('too many requests') ||
        description.includes('flood')) {
      const retryAfter = error.parameters?.retry_after || 30;
      return {
        isRecoverable: true,
        shouldDeactivateGroup: false,
        retryAfter: retryAfter * 1000,
        errorType: 'RATE_LIMIT',
        message: `Rate limited. Retry after ${retryAfter} seconds`,
      };
    }

    // Bot blocked or kicked - deactivate group
    if (error.error_code === TELEGRAM_ERRORS.BOT_BLOCKED ||
        description.includes('bot was blocked') ||
        description.includes('bot was kicked') ||
        description.includes('chat was deleted') ||
        description.includes('user is deactivated')) {
      return {
        isRecoverable: false,
        shouldDeactivateGroup: true,
        errorType: 'BOT_BLOCKED',
        message: 'Bot was blocked or kicked from this chat',
      };
    }

    // Chat not found - deactivate group
    if (description.includes('chat not found') ||
        description.includes('group chat was deactivated')) {
      return {
        isRecoverable: false,
        shouldDeactivateGroup: true,
        errorType: 'CHAT_NOT_FOUND',
        message: 'Chat not found or deactivated',
      };
    }

    // Write forbidden - don't retry but don't deactivate
    if (description.includes('have no rights') ||
        description.includes('write forbidden') ||
        description.includes('not enough rights')) {
      return {
        isRecoverable: false,
        shouldDeactivateGroup: false,
        errorType: 'PERMISSION_DENIED',
        message: 'Bot does not have permission to send messages',
      };
    }

    // Server errors - recoverable with retry
    if (error.error_code >= 500) {
      return {
        isRecoverable: true,
        shouldDeactivateGroup: false,
        retryAfter: 5000,
        errorType: 'SERVER_ERROR',
        message: 'Telegram server error. Will retry.',
      };
    }

    // Bad request - not recoverable
    if (error.error_code === TELEGRAM_ERRORS.BAD_REQUEST) {
      return {
        isRecoverable: false,
        shouldDeactivateGroup: false,
        errorType: 'BAD_REQUEST',
        message: error.description,
      };
    }

    return {
      isRecoverable: false,
      shouldDeactivateGroup: false,
      errorType: `TELEGRAM_${error.error_code}`,
      message: error.description,
    };
  }

  if (error instanceof HttpError) {
    // Network errors - recoverable
    return {
      isRecoverable: true,
      shouldDeactivateGroup: false,
      retryAfter: 5000,
      errorType: 'NETWORK_ERROR',
      message: 'Network error. Will retry.',
    };
  }

  return defaultInfo;
}

/**
 * Handle Telegram API errors with proper logging and group management
 */
async function handleTelegramError(
  error: unknown,
  chatId: string,
  operation: string
): Promise<TelegramErrorInfo> {
  const errorInfo = classifyTelegramError(error);

  logger.error(`Telegram API error during ${operation}`, {
    chatId,
    errorType: errorInfo.errorType,
    isRecoverable: errorInfo.isRecoverable,
    shouldDeactivateGroup: errorInfo.shouldDeactivateGroup,
    message: errorInfo.message,
  });

  // Deactivate group if needed
  if (errorInfo.shouldDeactivateGroup) {
    try {
      await TelegramGroup.findOneAndUpdate(
        { telegramId: chatId },
        {
          $set: {
            'settings.isActive': false,
            'botPermissions.canPostMessages': false,
          },
        }
      );
      logger.warn('Group deactivated due to error', {
        chatId,
        reason: errorInfo.errorType,
      });
    } catch (updateError) {
      logger.error('Failed to deactivate group', updateError, { chatId });
    }
  }

  return errorInfo;
}

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

    case 'delete-messages-bulk':
      return await processDeleteMessagesBulk(data as DeleteMessagesBulkJobData);

    case 'clear-all-messages':
      return await processClearAllMessages(data as ClearAllMessagesJobData);

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

  try {
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
  } catch (error) {
    const errorInfo = await handleTelegramError(error, data.chatId, 'sendMessage');

    // If recoverable, throw with retry info for BullMQ
    if (errorInfo.isRecoverable && errorInfo.retryAfter) {
      const retryError = new Error(errorInfo.message);
      (retryError as Error & { retryAfter: number }).retryAfter = errorInfo.retryAfter;
      throw retryError;
    }

    throw new Error(`${errorInfo.errorType}: ${errorInfo.message}`);
  }
}

/**
 * Delete a message from a Telegram chat
 */
async function processDeleteMessage(data: DeleteMessageJobData): Promise<{ success: boolean }> {
  if (!data.chatId || !data.messageId) {
    throw new Error('chatId and messageId are required');
  }

  await rateLimitDelay();

  try {
    const bot = await getBot();
    await bot.api.deleteMessage(data.chatId, data.messageId);

    logger.info('Message deleted via queue', {
      chatId: data.chatId,
      messageId: data.messageId,
    });

    return { success: true };
  } catch (error) {
    const errorInfo = await handleTelegramError(error, data.chatId, 'deleteMessage');

    // Message might already be deleted, which is fine
    if (errorInfo.errorType === 'BAD_REQUEST' &&
        errorInfo.message.toLowerCase().includes('message to delete not found')) {
      logger.warn('Message already deleted or not found', {
        chatId: data.chatId,
        messageId: data.messageId,
      });
      return { success: true };
    }

    // If recoverable, throw with retry info
    if (errorInfo.isRecoverable && errorInfo.retryAfter) {
      const retryError = new Error(errorInfo.message);
      (retryError as Error & { retryAfter: number }).retryAfter = errorInfo.retryAfter;
      throw retryError;
    }

    throw new Error(`${errorInfo.errorType}: ${errorInfo.message}`);
  }
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

/**
 * Delete multiple messages in bulk using Telegram's deleteMessages API
 * This is more efficient - can delete up to 100 messages per API call
 */
async function processDeleteMessagesBulk(data: DeleteMessagesBulkJobData): Promise<{
  success: boolean;
  deleted: number;
  failed: number;
  errors: string[];
}> {
  if (!data.chatId || !data.messageIds || data.messageIds.length === 0) {
    throw new Error('chatId and messageIds array are required');
  }

  const bot = await getBot();
  let deleted = 0;
  let failed = 0;
  const errors: string[] = [];

  logger.info('Starting bulk message deletion', {
    chatId: data.chatId,
    messageCount: data.messageIds.length,
  });

  // Telegram's deleteMessages can handle up to 100 messages at once
  const BATCH_SIZE = 100;
  const batches: number[][] = [];

  for (let i = 0; i < data.messageIds.length; i += BATCH_SIZE) {
    batches.push(data.messageIds.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    await rateLimitDelay();

    try {
      // Try using deleteMessages (bulk) - available in Telegram Bot API 6.7+
      // grammY supports this via bot.api.raw.deleteMessages
      await bot.api.raw.deleteMessages({
        chat_id: data.chatId,
        message_ids: batch,
      });

      deleted += batch.length;

      // Mark all as deleted in PostHistory
      if (data.groupDbId) {
        await PostHistory.updateMany(
          {
            groupId: data.groupDbId,
            messageId: { $in: batch.map(String) },
          },
          { $set: { 'metrics.deletedAt': new Date() } }
        );
      }

      logger.info('Deleted message batch', {
        chatId: data.chatId,
        batchSize: batch.length,
      });
    } catch (error) {
      const errorInfo = classifyTelegramError(error);

      // If bulk delete not supported or fails, fall back to individual deletion
      if (errorInfo.errorType === 'BAD_REQUEST') {
        logger.warn('Bulk delete failed, falling back to individual deletion', {
          error: errorInfo.message,
        });

        // Fall back to individual deletion
        for (const messageId of batch) {
          await rateLimitDelay();

          try {
            await bot.api.deleteMessage(data.chatId, messageId);
            deleted++;

            if (data.groupDbId) {
              await PostHistory.updateOne(
                { groupId: data.groupDbId, messageId: String(messageId) },
                { $set: { 'metrics.deletedAt': new Date() } }
              );
            }
          } catch (individualError) {
            const indErrorInfo = classifyTelegramError(individualError);

            // Message already deleted is considered success
            if (indErrorInfo.message.toLowerCase().includes('message to delete not found')) {
              deleted++;
              if (data.groupDbId) {
                await PostHistory.updateOne(
                  { groupId: data.groupDbId, messageId: String(messageId) },
                  { $set: { 'metrics.deletedAt': new Date() } }
                );
              }
              continue;
            }

            failed++;
            errors.push(`Message ${messageId}: ${indErrorInfo.message}`);
          }
        }
        continue;
      }

      // Rate limit - wait and retry the batch
      if (errorInfo.isRecoverable && errorInfo.retryAfter) {
        logger.warn('Rate limited during bulk delete, waiting', {
          retryAfter: errorInfo.retryAfter,
        });
        await new Promise(resolve => setTimeout(resolve, errorInfo.retryAfter));

        // Retry this batch
        try {
          await bot.api.raw.deleteMessages({
            chat_id: data.chatId,
            message_ids: batch,
          });
          deleted += batch.length;

          if (data.groupDbId) {
            await PostHistory.updateMany(
              {
                groupId: data.groupDbId,
                messageId: { $in: batch.map(String) },
              },
              { $set: { 'metrics.deletedAt': new Date() } }
            );
          }
          continue;
        } catch {
          // If still fails, count batch as failed
          failed += batch.length;
          errors.push(`Batch failed after retry: ${errorInfo.message}`);
        }
      } else {
        failed += batch.length;
        errors.push(`Batch failed: ${errorInfo.message}`);
      }
    }
  }

  logger.info('Bulk deletion completed', {
    chatId: data.chatId,
    deleted,
    failed,
    total: data.messageIds.length,
  });

  return { success: failed === 0, deleted, failed, errors };
}

/**
 * Clear all messages from a channel/group
 * Uses batch deletion for efficiency (up to 100 messages per API call)
 */
async function processClearAllMessages(data: ClearAllMessagesJobData): Promise<{
  success: boolean;
  deleted: number;
  failed: number;
  errors: string[];
}> {
  if (!data.chatId || !data.groupDbId) {
    throw new Error('chatId and groupDbId are required');
  }

  const bot = await getBot();
  let deleted = 0;
  let failed = 0;
  const errors: string[] = [];

  logger.info('Starting clear all messages', {
    chatId: data.chatId,
    groupDbId: data.groupDbId,
    fromMessageId: data.fromMessageId,
    toMessageId: data.toMessageId,
  });

  // Get the group to find the last known message ID
  const group = await TelegramGroup.findById(data.groupDbId);
  if (!group) {
    throw new Error('Group not found in database');
  }

  // Strategy 1: Delete messages from PostHistory (tracked messages) using batch deletion
  const historyQuery: Record<string, unknown> = {
    groupId: data.groupDbId,
    'metrics.deletedAt': { $exists: false },
  };

  if (data.olderThanDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - data.olderThanDays);
    historyQuery['sentAt'] = { $lt: cutoffDate };
  }

  const trackedMessages = await PostHistory.find(historyQuery)
    .select('messageId _id')
    .lean();

  logger.info('Found tracked messages to delete', {
    count: trackedMessages.length,
  });

  // Batch delete tracked messages (100 at a time)
  const BATCH_SIZE = 100;
  for (let i = 0; i < trackedMessages.length; i += BATCH_SIZE) {
    const batch = trackedMessages.slice(i, i + BATCH_SIZE);
    const messageIds = batch.map(m => parseInt(m.messageId, 10));
    const docIds = batch.map(m => m._id);

    await rateLimitDelay();

    try {
      // Try bulk delete first
      await bot.api.raw.deleteMessages({
        chat_id: data.chatId,
        message_ids: messageIds,
      });

      deleted += batch.length;

      // Mark all as deleted
      await PostHistory.updateMany(
        { _id: { $in: docIds } },
        { $set: { 'metrics.deletedAt': new Date() } }
      );

      logger.info('Deleted tracked message batch', { batchSize: batch.length });
    } catch (error) {
      const errorInfo = classifyTelegramError(error);

      // Fall back to individual deletion if bulk fails
      logger.warn('Bulk delete failed, falling back to individual', {
        error: errorInfo.message,
      });

      for (const msg of batch) {
        await rateLimitDelay();
        const messageId = parseInt(msg.messageId, 10);

        try {
          await bot.api.deleteMessage(data.chatId, messageId);
          deleted++;
          await PostHistory.updateOne(
            { _id: msg._id },
            { $set: { 'metrics.deletedAt': new Date() } }
          );
        } catch (indError) {
          const indErrorInfo = classifyTelegramError(indError);

          if (indErrorInfo.message.toLowerCase().includes('message to delete not found')) {
            deleted++;
            await PostHistory.updateOne(
              { _id: msg._id },
              { $set: { 'metrics.deletedAt': new Date() } }
            );
            continue;
          }

          failed++;
          errors.push(`Message ${msg.messageId}: ${indErrorInfo.message}`);
        }
      }
    }
  }

  // Strategy 2: If range specified, try to delete messages in that range using batches
  if (data.fromMessageId && data.toMessageId) {
    logger.info('Attempting range deletion', {
      from: data.fromMessageId,
      to: data.toMessageId,
    });

    // Build batches of message IDs for range deletion
    const rangeIds: number[] = [];
    for (let msgId = data.toMessageId; msgId >= data.fromMessageId; msgId--) {
      rangeIds.push(msgId);
    }

    for (let i = 0; i < rangeIds.length; i += BATCH_SIZE) {
      const batch = rangeIds.slice(i, i + BATCH_SIZE);

      await rateLimitDelay();

      try {
        await bot.api.raw.deleteMessages({
          chat_id: data.chatId,
          message_ids: batch,
        });
        deleted += batch.length;
      } catch (error) {
        const errorInfo = classifyTelegramError(error);

        // Permission denied - stop trying range deletion
        if (errorInfo.errorType === 'PERMISSION_DENIED') {
          logger.warn('Permission denied for range deletion, stopping', {
            chatId: data.chatId,
          });
          errors.push('Permission denied for range deletion');
          break;
        }

        // Handle rate limits
        if (errorInfo.isRecoverable && errorInfo.retryAfter) {
          await new Promise(resolve => setTimeout(resolve, errorInfo.retryAfter));
          try {
            await bot.api.raw.deleteMessages({
              chat_id: data.chatId,
              message_ids: batch,
            });
            deleted += batch.length;
          } catch {
            // If bulk fails, try individual
            for (const msgId of batch) {
              try {
                await bot.api.deleteMessage(data.chatId, msgId);
                deleted++;
              } catch {
                // Ignore individual failures in range deletion
              }
            }
          }
          continue;
        }

        // For other errors, try individual deletion
        for (const msgId of batch) {
          try {
            await bot.api.deleteMessage(data.chatId, msgId);
            deleted++;
          } catch {
            // Ignore - message might not exist
          }
        }
      }
    }
  }

  logger.info('Clear all messages completed', {
    chatId: data.chatId,
    deleted,
    failed,
  });

  return { success: failed === 0 || deleted > 0, deleted, failed, errors };
}
