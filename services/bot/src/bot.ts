import { Bot, Api } from 'grammy';
import { getSettings, logger } from '@common';

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
