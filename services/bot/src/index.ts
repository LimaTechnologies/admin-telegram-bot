import {
  connectDB,
  getSettings,
  logger,
  getBot,
  handleBotAddedToGroup,
  handleBotRemovedFromGroup,
  handleBotPermissionsChanged,
} from '@common';
import { InlineKeyboard } from 'grammy';
import { registerPurchaseHandlers, showModelProfile } from './handlers/purchase.handler';

async function main() {
  logger.info('Starting bot service...');

  // Connect to database
  await connectDB();
  logger.info('Connected to database');

  // Get bot instance (singleton)
  const bot = await getBot();

  // Setup bot commands menu
  await bot.api.setMyCommands([
    { command: 'start', description: '🏠 Inicio' },
    { command: 'models', description: '🔥 Ver conteudo' },
    { command: 'history', description: '📋 Minhas compras' },
    { command: 'help', description: '❓ Ajuda' },
  ]);
  logger.info('Bot commands menu configured');

  // Register purchase handlers (models, buy, history)
  registerPurchaseHandlers(bot);
  logger.info('Purchase handlers registered');

  // Handle /start command with deep link support
  bot.command('start', async (ctx) => {
    const payload = ctx.match?.toString().trim();
    logger.info('Start command received', { payload, userId: ctx.from?.id });

    // Deep link to specific model
    if (payload && payload.startsWith('model_')) {
      const modelId = payload.replace('model_', '');
      logger.info('Deep link to model', { modelId });
      await showModelProfile(ctx, modelId);
      return;
    }

    // Default welcome with buttons
    const welcomeKeyboard = new InlineKeyboard()
      .text('🔥 Ver Conteudo', 'back_to_models')
      .row()
      .text('📋 Minhas Compras', 'show_history');

    await ctx.reply(
      '<b>Seja bem-vindo!</b> 👋\n\n' +
      'Aqui voce encontra conteudo exclusivo.\n\n' +
      '<i>Clique abaixo para comecar:</i>',
      {
        parse_mode: 'HTML',
        reply_markup: welcomeKeyboard,
      }
    );
  });

  // Handle /help command
  bot.command('help', async (ctx) => {
    const helpKeyboard = new InlineKeyboard()
      .text('🔥 Ver Conteudo', 'back_to_models')
      .row()
      .url('📩 Suporte', 'https://t.me/suporte');

    await ctx.reply(
      '<b>Como funciona?</b> 🤔\n\n' +
      '1️⃣ Escolha uma modelo\n' +
      '2️⃣ Veja o conteudo gratuito\n' +
      '3️⃣ Escolha um pack ou assinatura\n' +
      '4️⃣ Libere o acesso\n\n' +
      '<i>Duvidas? Fale com o suporte.</i>',
      {
        parse_mode: 'HTML',
        reply_markup: helpKeyboard,
      }
    );
  });

  // Handle /status command (admin only)
  bot.command('status', async (ctx) => {
    const currentSettings = await getSettings();
    const status = currentSettings.spamControl.emergencyStopActive
      ? 'Emergency Stop'
      : currentSettings.bot.isActive
        ? 'Ativo'
        : 'Inativo';

    await ctx.reply(`Bot Status: ${status}`);
  });

  // Handle my_chat_member updates
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

    if (update.chat.type === 'private') return;

    if (
      (newStatus === 'administrator' || newStatus === 'creator') &&
      (oldStatus === 'left' || oldStatus === 'kicked' || oldStatus === 'member')
    ) {
      await handleBotAddedToGroup(chatId);
    } else if (
      (newStatus === 'left' || newStatus === 'kicked') &&
      (oldStatus === 'administrator' || oldStatus === 'creator' || oldStatus === 'member')
    ) {
      await handleBotRemovedFromGroup(chatId);
    } else if (
      (newStatus === 'administrator' || newStatus === 'creator') &&
      (oldStatus === 'administrator' || oldStatus === 'creator')
    ) {
      await handleBotPermissionsChanged(chatId);
    } else if (newStatus === 'member' && (oldStatus === 'administrator' || oldStatus === 'creator')) {
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
