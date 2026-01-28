import { Bot, Api } from 'grammy';
import type { Chat, ChatMemberAdministrator } from 'grammy/types';
import { getSettings } from '../models/settings.model';
import { logger } from './logger';
import type { BotPermissions, GroupSyncResult, GroupType } from '$types/telegram-group';
import { TelegramGroup } from '../models/telegram-group.model';

let botInstance: Bot | null = null;
let botApi: Api | null = null;

/**
 * Get or create the bot instance singleton
 */
export async function getBot(): Promise<Bot> {
  if (botInstance) {
    return botInstance;
  }

  const settings = await getSettings();
  const token = settings.bot.token || process.env['TELEGRAM_BOT_TOKEN'];

  if (!token) {
    throw new Error('Bot token not configured. Set TELEGRAM_BOT_TOKEN or configure in settings.');
  }

  botInstance = new Bot(token);
  botApi = botInstance.api;

  logger.info('Bot instance created');
  return botInstance;
}

/**
 * Get the bot API for direct API calls (without full bot setup)
 */
export async function getBotApi(): Promise<Api> {
  if (botApi) {
    return botApi;
  }

  await getBot();
  return botApi!;
}

/**
 * Get bot info (username, id, etc.)
 */
export async function getBotInfo(): Promise<{ id: number; username: string; firstName: string }> {
  const bot = await getBot();
  const me = await bot.api.getMe();
  return {
    id: me.id,
    username: me.username || '',
    firstName: me.first_name,
  };
}

/**
 * Stop the bot gracefully
 */
export async function stopBot(): Promise<void> {
  if (botInstance) {
    await botInstance.stop();
    botInstance = null;
    botApi = null;
    logger.info('Bot stopped');
  }
}

/**
 * Check if bot is initialized
 */
export function isBotInitialized(): boolean {
  return botInstance !== null;
}

/**
 * Get detailed information about a chat
 */
export async function getChatDetails(chatId: string | number): Promise<Chat.GroupChat | Chat.SupergroupChat | Chat.ChannelChat | null> {
  try {
    const api = await getBotApi();
    const chat = await api.getChat(chatId);

    if (chat.type === 'private') {
      return null;
    }

    return chat as Chat.GroupChat | Chat.SupergroupChat | Chat.ChannelChat;
  } catch (error) {
    logger.error('Failed to get chat details', error, { chatId });
    return null;
  }
}

/**
 * Get bot's permissions in a specific chat
 */
export async function getBotPermissions(chatId: string | number): Promise<BotPermissions | null> {
  try {
    const api = await getBotApi();
    const botInfo = await getBotInfo();
    const member = await api.getChatMember(chatId, botInfo.id);

    if (member.status === 'administrator') {
      const admin = member as ChatMemberAdministrator;
      return {
        canPostMessages: admin.can_post_messages ?? true,
        canDeleteMessages: admin.can_delete_messages ?? false,
        canPinMessages: admin.can_pin_messages ?? false,
        canInviteUsers: admin.can_invite_users ?? false,
        canRestrictMembers: admin.can_restrict_members ?? false,
        canPromoteMembers: admin.can_promote_members ?? false,
        canChangeInfo: admin.can_change_info ?? false,
        canManageChat: admin.can_manage_chat ?? false,
      };
    } else if (member.status === 'creator') {
      // Creator has all permissions
      return {
        canPostMessages: true,
        canDeleteMessages: true,
        canPinMessages: true,
        canInviteUsers: true,
        canRestrictMembers: true,
        canPromoteMembers: true,
        canChangeInfo: true,
        canManageChat: true,
      };
    }

    // Bot is not an admin
    return null;
  } catch (error) {
    logger.error('Failed to get bot permissions', error, { chatId });
    return null;
  }
}

/**
 * Get member count for a chat
 */
export async function getChatMemberCount(chatId: string | number): Promise<number> {
  try {
    const api = await getBotApi();
    return await api.getChatMemberCount(chatId);
  } catch (error) {
    logger.error('Failed to get member count', error, { chatId });
    return 0;
  }
}

/**
 * Map Telegram chat type to our GroupType
 */
function mapChatType(type: string): GroupType {
  switch (type) {
    case 'group':
      return 'public';
    case 'supergroup':
      return 'supergroup';
    case 'channel':
      return 'channel';
    default:
      return 'supergroup';
  }
}

/**
 * Sync a group's information to the database
 */
export async function syncGroupToDatabase(chatId: string | number): Promise<GroupSyncResult> {
  const telegramId = chatId.toString();

  try {
    const chat = await getChatDetails(chatId);
    if (!chat) {
      return {
        groupId: '',
        telegramId,
        name: 'Unknown',
        success: false,
        error: 'Could not get chat details or chat is private',
        isNew: false,
      };
    }

    const permissions = await getBotPermissions(chatId);
    if (!permissions) {
      return {
        groupId: '',
        telegramId,
        name: 'title' in chat ? chat.title : 'Unknown',
        success: false,
        error: 'Bot is not an administrator in this chat',
        isNew: false,
      };
    }

    const memberCount = await getChatMemberCount(chatId);

    // Check if group already exists
    const existingGroup = await TelegramGroup.findOne({ telegramId });
    const isNew = !existingGroup;

    // Prepare update data
    const updateData = {
      telegramId,
      name: 'title' in chat ? chat.title : 'Unknown',
      username: 'username' in chat ? chat.username : undefined,
      type: mapChatType(chat.type),
      description: 'description' in chat ? chat.description : undefined,
      inviteLink: 'invite_link' in chat ? chat.invite_link : undefined,
      botPermissions: permissions,
      lastSyncAt: new Date(),
      discoveredAt: isNew ? new Date() : existingGroup.discoveredAt,
      isAutoDiscovered: isNew ? true : existingGroup.isAutoDiscovered,
      'stats.memberCount': memberCount,
    };

    // Upsert the group
    const group = await TelegramGroup.findOneAndUpdate(
      { telegramId },
      { $set: updateData },
      { upsert: true, new: true }
    );

    logger.info('Group synced successfully', {
      telegramId,
      name: updateData.name,
      isNew,
      memberCount,
    });

    return {
      groupId: group._id.toString(),
      telegramId,
      name: updateData.name,
      success: true,
      isNew,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to sync group', error, { telegramId });

    return {
      groupId: '',
      telegramId,
      name: 'Unknown',
      success: false,
      error: errorMessage,
      isNew: false,
    };
  }
}

/**
 * Discover all groups where the bot is an admin.
 * Note: Telegram doesn't have an API to list all chats the bot is in.
 * This function syncs all known groups from our database.
 * New groups are discovered via the my_chat_member event handler.
 */
export async function discoverAllGroups(): Promise<GroupSyncResult[]> {
  const results: GroupSyncResult[] = [];

  try {
    // Get all groups from database
    const groups = await TelegramGroup.find({}).select('telegramId');

    logger.info('Starting group discovery', { totalGroups: groups.length });

    // Sync each group
    for (const group of groups) {
      const result = await syncGroupToDatabase(group.telegramId);
      results.push(result);

      // Rate limiting: wait 100ms between API calls
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    logger.info('Group discovery completed', {
      total: results.length,
      success: successCount,
      failed: failCount,
    });

    return results;
  } catch (error) {
    logger.error('Group discovery failed', error);
    return results;
  }
}

/**
 * Handle when bot is added to a new group
 */
export async function handleBotAddedToGroup(chatId: number): Promise<GroupSyncResult> {
  logger.info('Bot added to group', { chatId });
  return await syncGroupToDatabase(chatId);
}

/**
 * Handle when bot is removed from a group
 */
export async function handleBotRemovedFromGroup(chatId: number): Promise<void> {
  const telegramId = chatId.toString();

  try {
    // Mark group as inactive instead of deleting
    await TelegramGroup.findOneAndUpdate(
      { telegramId },
      {
        $set: {
          'settings.isActive': false,
          botPermissions: null,
          lastSyncAt: new Date(),
        },
      }
    );

    logger.info('Bot removed from group - marked as inactive', { telegramId });
  } catch (error) {
    logger.error('Failed to handle bot removal', error, { telegramId });
  }
}

/**
 * Handle when bot's permissions change in a group
 */
export async function handleBotPermissionsChanged(chatId: number): Promise<GroupSyncResult> {
  logger.info('Bot permissions changed', { chatId });
  return await syncGroupToDatabase(chatId);
}
