import type { Chat, ChatMemberAdministrator } from 'grammy/types';
import { getBotApi, getBotInfo } from '../bot';
import { TelegramGroup, logger } from '@common';
import type { BotPermissions, GroupSyncResult, GroupType } from '$types/telegram-group';

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
 * Normalize a Telegram chat ID by adding -100 prefix if needed for supergroups/channels.
 * Telegram supergroups and channels have IDs that start with -100.
 */
function normalizeTelegramId(chatId: string | number): string {
  const idStr = chatId.toString();

  // If it's already negative and starts with -100, return as is
  if (idStr.startsWith('-100')) {
    return idStr;
  }

  // If it's negative but doesn't start with -100, it might be missing the prefix
  if (idStr.startsWith('-') && !idStr.startsWith('-100')) {
    // Remove the leading minus and add -100 prefix
    return `-100${idStr.slice(1)}`;
  }

  // If it's positive, it might be a channel/supergroup ID without the sign
  if (!idStr.startsWith('-') && idStr.length > 10) {
    return `-100${idStr}`;
  }

  // Return as is for regular groups (positive smaller IDs)
  return idStr;
}

/**
 * Sync a group's information to the database
 */
export async function syncGroupToDatabase(chatId: string | number): Promise<GroupSyncResult> {
  let telegramId = chatId.toString();

  try {
    // First try with original ID
    let chat = await getChatDetails(chatId);

    // If not found and ID doesn't have -100 prefix, try with normalized ID
    if (!chat && !telegramId.startsWith('-100')) {
      const normalizedId = normalizeTelegramId(chatId);
      if (normalizedId !== telegramId) {
        logger.info('Retrying with normalized Telegram ID', { original: telegramId, normalized: normalizedId });
        chat = await getChatDetails(normalizedId);
        if (chat) {
          // Use the normalized ID
          telegramId = normalizedId;
        }
      }
    }

    if (!chat) {
      return {
        groupId: '',
        telegramId,
        name: 'Unknown',
        success: false,
        error: 'Could not get chat details or chat is private. Make sure the bot is a member of the group and the ID is correct (supergroups/channels need -100 prefix).',
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
