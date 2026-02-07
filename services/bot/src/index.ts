import {
  connectDB,
  getSettings,
  logger,
  getBot,
  handleBotAddedToGroup,
  handleBotRemovedFromGroup,
  handleBotPermissionsChanged,
} from '@common';
import { registerPurchaseHandlers } from './handlers/purchase.handler';

async function main() {
  logger.info('Starting bot service...');

  // Connect to database
  await connectDB();
  logger.info('Connected to database');

  // Get bot instance (singleton)
  const bot = await getBot();

  // Register purchase handlers (models, buy, history)
  registerPurchaseHandlers(bot);
  logger.info('Purchase handlers registered');

  // Handle /start command
  bot.command('start', async (ctx) => {
    await ctx.reply(
      '👋 Bem-vindo ao Bot de Modelos!\n\n' +
      '📱 *Comandos disponíveis:*\n' +
      '/models - Ver modelos disponíveis\n' +
      '/history - Ver histórico de compras\n' +
      '/status - Status do bot\n\n' +
      'Escolha uma modelo e compre conteúdo exclusivo via PIX!',
      { parse_mode: 'Markdown' }
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

  // Handle my_chat_member updates - when bot is added/removed/promoted/demoted
  bot.on('my_chat_member', async (ctx) => {
    const update = ctx.myChatMember;
    const chatId = update.chat.id;
    const oldStatus = update.old_chat_member.status;
    const newStatus = update.new_chat_member.status;

    logger.info('my_chat_member update received', {
      chatId,
      chatType: update.chat.type,
      oldStatus,
      newStatus,
    });

    // Skip private chats
    if (update.chat.type === 'private') {
      return;
    }

    // Bot was added as admin (or promoted)
    if (
      (newStatus === 'administrator' || newStatus === 'creator') &&
      (oldStatus === 'left' || oldStatus === 'kicked' || oldStatus === 'member')
    ) {
      await handleBotAddedToGroup(chatId);
    }
    // Bot was removed (left, kicked, or restricted)
    else if (
      (newStatus === 'left' || newStatus === 'kicked') &&
      (oldStatus === 'administrator' || oldStatus === 'creator' || oldStatus === 'member')
    ) {
      await handleBotRemovedFromGroup(chatId);
    }
    // Bot permissions changed (still admin but different permissions)
    else if (
      (newStatus === 'administrator' || newStatus === 'creator') &&
      (oldStatus === 'administrator' || oldStatus === 'creator')
    ) {
      await handleBotPermissionsChanged(chatId);
    }
    // Bot was demoted from admin to regular member
    else if (newStatus === 'member' && (oldStatus === 'administrator' || oldStatus === 'creator')) {
      await handleBotRemovedFromGroup(chatId);
    }
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
