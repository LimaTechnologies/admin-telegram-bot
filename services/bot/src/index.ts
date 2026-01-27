import { Bot } from 'grammy';
import { connectDB, getSettings, logger } from '@common';

async function main() {
  logger.info('Starting bot service...');

  // Connect to database
  await connectDB();
  logger.info('Connected to database');

  // Get bot token from settings
  const settings = await getSettings();
  const token = settings.bot.token || process.env['TELEGRAM_BOT_TOKEN'];

  if (!token) {
    throw new Error('Bot token not configured. Set TELEGRAM_BOT_TOKEN or configure in settings.');
  }

  // Create bot instance
  const bot = new Bot(token);

  // Handle /start command
  bot.command('start', async (ctx) => {
    await ctx.reply(
      'Welcome to the Ads Bot! This bot is managed by the Admin Dashboard.\n\n' +
      'Use /status to check the bot status.'
    );
  });

  // Handle /status command
  bot.command('status', async (ctx) => {
    const currentSettings = await getSettings();
    const status = currentSettings.spamControl.emergencyStopActive
      ? 'Emergency Stop Active'
      : currentSettings.bot.isActive
        ? 'Active'
        : 'Inactive';

    await ctx.reply(
      `Bot Status: ${status}\n` +
      `Global Rate Limit: ${currentSettings.spamControl.globalMaxAdsPerHour} ads/hour\n` +
      `Manual Approval: ${currentSettings.spamControl.requireManualApproval ? 'Required' : 'Not Required'}`
    );
  });

  // Error handler
  bot.catch((err) => {
    logger.error('Bot error', err.error, { ctx: err.ctx?.update });
  });

  // Start the bot
  bot.start({
    onStart: (botInfo) => {
      logger.info('Bot started', { username: botInfo.username });
    },
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down bot...');
    await bot.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error('Bot service failed to start', err);
  process.exit(1);
});
