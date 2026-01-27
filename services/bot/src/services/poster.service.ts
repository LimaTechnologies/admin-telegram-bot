import { Bot } from 'grammy';
import { getSettings, logger } from '@common';

interface SendMessageOptions {
  groupId: string;
  creative: {
    mediaType: 'image' | 'video' | 'text';
    mediaUrl?: string;
    caption: string;
    ctaUrl?: string;
  };
}

interface SendMessageResult {
  success: boolean;
  messageId: string;
  error?: string;
}

let botInstance: Bot | null = null;

async function getBotInstance(): Promise<Bot> {
  if (botInstance) {
    return botInstance;
  }

  const settings = await getSettings();
  const token = settings.bot.token || process.env['TELEGRAM_BOT_TOKEN'];

  if (!token) {
    throw new Error('Bot token not configured');
  }

  botInstance = new Bot(token);
  return botInstance;
}

export async function sendTelegramMessage(options: SendMessageOptions): Promise<SendMessageResult> {
  const { groupId, creative } = options;

  try {
    // Check if bot is active
    const settings = await getSettings();
    if (!settings.bot.isActive) {
      throw new Error('Bot is not active');
    }

    if (settings.spamControl.emergencyStopActive) {
      throw new Error('Emergency stop is active');
    }

    const bot = await getBotInstance();

    // Build caption with CTA
    let caption = creative.caption;
    if (creative.ctaUrl) {
      caption += `\n\n${creative.ctaUrl}`;
    }

    let result;

    switch (creative.mediaType) {
      case 'image':
        if (!creative.mediaUrl) {
          throw new Error('Image URL required');
        }
        result = await bot.api.sendPhoto(groupId, creative.mediaUrl, {
          caption,
          parse_mode: 'HTML',
        });
        break;

      case 'video':
        if (!creative.mediaUrl) {
          throw new Error('Video URL required');
        }
        result = await bot.api.sendVideo(groupId, creative.mediaUrl, {
          caption,
          parse_mode: 'HTML',
        });
        break;

      case 'text':
      default:
        result = await bot.api.sendMessage(groupId, caption, {
          parse_mode: 'HTML',
          link_preview_options: {
            is_disabled: false,
          },
        });
        break;
    }

    logger.info('Message sent', {
      groupId,
      messageId: result.message_id,
      mediaType: creative.mediaType,
    });

    return {
      success: true,
      messageId: result.message_id.toString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to send message', error, { groupId });

    return {
      success: false,
      messageId: '',
      error: errorMessage,
    };
  }
}

export async function deleteMessage(groupId: string, messageId: number): Promise<boolean> {
  try {
    const bot = await getBotInstance();
    await bot.api.deleteMessage(groupId, messageId);
    return true;
  } catch (error) {
    logger.error('Failed to delete message', error, { groupId, messageId });
    return false;
  }
}

export async function getGroupInfo(groupId: string): Promise<{ memberCount: number; title: string } | null> {
  try {
    const bot = await getBotInstance();
    const chat = await bot.api.getChat(groupId);
    const memberCount = await bot.api.getChatMemberCount(groupId);

    return {
      memberCount,
      title: 'title' in chat ? chat.title || '' : '',
    };
  } catch (error) {
    logger.error('Failed to get group info', error, { groupId });
    return null;
  }
}
