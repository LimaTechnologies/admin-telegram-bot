import { Bot, InlineKeyboard, Context } from 'grammy';
import {
  OFModel,
  PurchaseModel,
  TransactionModel,
  TelegramUserModel,
  StorageService,
  logger,
} from '@common';
import { ArkamaService } from '@common/services/arkama.service';

// ============ HELPERS ============

function getTierEmoji(tier: string): string {
  return { platinum: '💎', gold: '🥇', silver: '🥈', bronze: '🥉' }[tier] || '⭐';
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(price);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============ MAIN HANDLER ============

export function registerPurchaseHandlers(bot: Bot) {
  // /models command
  bot.command('models', async (ctx) => {
    await showModelsList(ctx);
  });

  // /history command
  bot.command('history', async (ctx) => {
    await showPurchaseHistory(ctx);
  });

  // Handle all callback queries
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    logger.info('Callback received', { data, userId: ctx.from?.id });

    try {
      // Navigation
      if (data === 'back_to_models') {
        await showModelsList(ctx);
      } else if (data === 'show_history') {
        await showPurchaseHistory(ctx);
      }
      // Model profile
      else if (data.startsWith('model_')) {
        const modelId = data.replace('model_', '');
        await showModelProfile(ctx, modelId);
      }
      // View packs menu
      else if (data.startsWith('packs_')) {
        const modelId = data.replace('packs_', '');
        await showPacksMenu(ctx, modelId);
      }
      // View subscription option
      else if (data.startsWith('subscribe_')) {
        const modelId = data.replace('subscribe_', '');
        await showSubscriptionOption(ctx, modelId);
      }
      // Pack details (before purchase)
      else if (data.startsWith('pack_')) {
        const [, modelId, productId] = data.split('_');
        await showPackDetails(ctx, modelId, productId);
      }
      // Confirm purchase (checkout)
      else if (data.startsWith('buy_')) {
        const [, modelId, productId] = data.split('_');
        await processCheckout(ctx, modelId, productId);
      }
      // Check payment status
      else if (data.startsWith('check_')) {
        const purchaseId = data.replace('check_', '');
        await checkPaymentStatus(ctx, purchaseId);
      }
      // Cancel
      else if (data === 'cancel') {
        await cancelPurchase(ctx);
      }

      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Callback error', { error, data });
      await ctx.answerCallbackQuery({ text: 'Erro, tente novamente' });
    }
  });
}

// ============ 1. MODELS LIST ============

async function showModelsList(ctx: Context) {
  try {
    const models = await OFModel.find({
      isActive: true,
      'products.0': { $exists: true },
    })
      .sort({ tier: -1 })
      .select('_id name tier products')
      .limit(10);

    if (models.length === 0) {
      await ctx.reply('Nenhuma modelo disponivel no momento.\n\nVolte mais tarde!');
      return;
    }

    const keyboard = new InlineKeyboard();

    models.forEach((model) => {
      const tierEmoji = getTierEmoji(model.tier);
      const activeProducts = model.products.filter((p) => p.isActive);
      const minPrice = Math.min(...activeProducts.map((p) => p.price));
      keyboard.text(`${tierEmoji} ${model.name} • a partir R$${minPrice.toFixed(0)}`, `model_${model._id}`).row();
    });

    await ctx.reply('🔥 <b>Modelos Disponiveis</b>\n\nEscolha uma para ver o conteudo:', {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error('Error showing models list', { error });
    await ctx.reply('Erro ao carregar. Tente novamente.');
  }
}

// ============ 2. MODEL PROFILE (com galeria) ============

export async function showModelProfile(ctx: Context, modelId: string) {
  try {
    const model = await OFModel.findById(modelId);

    if (!model || !model.isActive) {
      await ctx.reply('Modelo nao encontrada.');
      return;
    }

    const tierEmoji = getTierEmoji(model.tier);
    const hasPacks = model.products.filter((p) => p.type !== 'subscription' && p.isActive).length > 0;
    const hasSubscription = model.products.some((p) => p.type === 'subscription' && p.isActive);

    // Build action buttons
    const keyboard = new InlineKeyboard();

    if (hasPacks) {
      keyboard.text('📦 Ver Packs', `packs_${modelId}`);
    }
    if (hasSubscription) {
      keyboard.text('⭐ Assinar', `subscribe_${modelId}`);
    }
    keyboard.row();

    if (model.referralLink || model.onlyfansUrl) {
      keyboard.url('💋 OnlyFans', model.referralLink || model.onlyfansUrl).row();
    }

    keyboard.text('👀 Ver outras modelos', 'back_to_models');

    // Caption
    const caption = `${tierEmoji} <b>${escapeHtml(model.name)}</b>\n@${escapeHtml(model.username)}\n\n${model.bio ? escapeHtml(model.bio) : ''}`;

    // Send gallery if multiple photos
    if (model.previewPhotos && model.previewPhotos.length > 1) {
      const mediaGroup = model.previewPhotos.slice(0, 4).map((photo, idx) => {
        const url = photo.startsWith('http') ? photo : StorageService.getPublicUrl(photo);
        return {
          type: 'photo' as const,
          media: url,
          caption: idx === 0 ? caption : undefined,
          parse_mode: idx === 0 ? ('HTML' as const) : undefined,
        };
      });

      try {
        await ctx.replyWithMediaGroup(mediaGroup);
        await ctx.reply('👆 Gostou? Escolha uma opcao:', { reply_markup: keyboard });
        return;
      } catch (galleryError) {
        logger.error('Gallery failed', { error: galleryError });
      }
    }

    // Single photo fallback
    if (model.previewPhotos && model.previewPhotos.length > 0) {
      const photoUrl = model.previewPhotos[0].startsWith('http')
        ? model.previewPhotos[0]
        : StorageService.getPublicUrl(model.previewPhotos[0]);

      try {
        await ctx.replyWithPhoto(photoUrl, {
          caption,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        return;
      } catch {
        // continue to text
      }
    }

    // Text fallback
    await ctx.reply(caption + '\n\nEscolha uma opcao:', {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error('Error showing model profile', { error, modelId });
    await ctx.reply('Erro ao carregar. Tente novamente.');
  }
}

// ============ 3. PACKS MENU ============

async function showPacksMenu(ctx: Context, modelId: string) {
  try {
    const model = await OFModel.findById(modelId);
    if (!model) {
      await ctx.reply('Modelo nao encontrada.');
      return;
    }

    const packs = model.products.filter((p) => p.type !== 'subscription' && p.isActive);

    if (packs.length === 0) {
      await ctx.reply('Nenhum pack disponivel no momento.');
      return;
    }

    const keyboard = new InlineKeyboard();

    packs.forEach((pack) => {
      const price = formatPrice(pack.price, pack.currency);
      keyboard.text(`📦 ${pack.name} • ${price}`, `pack_${modelId}_${pack._id}`).row();
    });

    keyboard.text('⬅️ Voltar', `model_${modelId}`);

    await ctx.reply(
      `<b>📦 Packs de ${escapeHtml(model.name)}</b>\n\nEscolha um pack para ver detalhes:`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
  } catch (error) {
    logger.error('Error showing packs menu', { error, modelId });
    await ctx.reply('Erro ao carregar. Tente novamente.');
  }
}

// ============ 4. PACK DETAILS ============

async function showPackDetails(ctx: Context, modelId: string, productId: string) {
  try {
    const model = await OFModel.findById(modelId);
    if (!model) {
      await ctx.reply('Modelo nao encontrada.');
      return;
    }

    const pack = model.products.find((p) => p._id.toString() === productId);
    if (!pack || !pack.isActive) {
      await ctx.reply('Pack nao disponivel.');
      return;
    }

    const price = formatPrice(pack.price, pack.currency);

    const keyboard = new InlineKeyboard()
      .text(`🔓 Liberar Acesso • ${price}`, `buy_${modelId}_${productId}`)
      .row()
      .text('⬅️ Voltar aos packs', `packs_${modelId}`);

    // Send pack preview if available
    if (pack.previewImages && pack.previewImages.length > 0) {
      const photoUrl = pack.previewImages[0].startsWith('http')
        ? pack.previewImages[0]
        : StorageService.getPublicUrl(pack.previewImages[0]);

      try {
        await ctx.replyWithPhoto(photoUrl, {
          caption:
            `<b>📦 ${escapeHtml(pack.name)}</b>\n\n` +
            `${pack.description ? escapeHtml(pack.description) + '\n\n' : ''}` +
            `💰 <b>${price}</b>\n\n` +
            `<i>Acesso permanente apos a compra</i>`,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        return;
      } catch {
        // continue to text
      }
    }

    await ctx.reply(
      `<b>📦 ${escapeHtml(pack.name)}</b>\n\n` +
        `${pack.description ? escapeHtml(pack.description) + '\n\n' : ''}` +
        `💰 <b>${price}</b>\n\n` +
        `<i>Acesso permanente apos a compra</i>`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
  } catch (error) {
    logger.error('Error showing pack details', { error, modelId, productId });
    await ctx.reply('Erro ao carregar. Tente novamente.');
  }
}

// ============ 5. SUBSCRIPTION OPTION ============

async function showSubscriptionOption(ctx: Context, modelId: string) {
  try {
    const model = await OFModel.findById(modelId);
    if (!model) {
      await ctx.reply('Modelo nao encontrada.');
      return;
    }

    const subscription = model.products.find((p) => p.type === 'subscription' && p.isActive);
    if (!subscription) {
      await ctx.reply('Assinatura nao disponivel no momento.');
      return;
    }

    const price = formatPrice(subscription.price, subscription.currency);

    const keyboard = new InlineKeyboard()
      .text(`⭐ Assinar • ${price}/mes`, `buy_${modelId}_${subscription._id}`)
      .row()
      .text('⬅️ Voltar', `model_${modelId}`);

    await ctx.reply(
      `<b>⭐ Assinatura VIP - ${escapeHtml(model.name)}</b>\n\n` +
        `✅ Acesso a todo conteudo novo\n` +
        `✅ Chat privado\n` +
        `✅ Conteudo exclusivo para assinantes\n\n` +
        `${subscription.description ? escapeHtml(subscription.description) + '\n\n' : ''}` +
        `💰 <b>${price}/mes</b>\n\n` +
        `<i>Cancele quando quiser</i>`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
  } catch (error) {
    logger.error('Error showing subscription', { error, modelId });
    await ctx.reply('Erro ao carregar. Tente novamente.');
  }
}

// ============ 6. CHECKOUT ============

async function processCheckout(ctx: Context, modelId: string, productId: string) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Erro: usuario nao identificado.');
      return;
    }

    const model = await OFModel.findById(modelId);
    if (!model) {
      await ctx.reply('Modelo nao encontrada.');
      return;
    }

    const product = model.products.find((p) => p._id.toString() === productId);
    if (!product || !product.isActive) {
      await ctx.reply('Produto nao disponivel.');
      return;
    }

    await ctx.reply('⏳ Gerando acesso...');

    // Create/update telegram user
    await TelegramUserModel.findOneAndUpdate(
      { telegramId: userId },
      {
        telegramId: userId,
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        lastName: ctx.from?.last_name,
      },
      { upsert: true }
    );

    // Create purchase
    const purchase = await PurchaseModel.create({
      telegramUserId: userId,
      telegramUsername: ctx.from?.username,
      telegramFirstName: ctx.from?.first_name,
      modelId: model._id,
      productId: product._id,
      productSnapshot: {
        name: product.name,
        type: product.type,
        price: product.price,
        currency: product.currency,
      },
      amount: product.price,
      currency: product.currency,
      status: 'pending',
    });

    // Create transaction
    const transaction = await TransactionModel.create({
      purchaseId: purchase._id,
      paymentMethod: 'pix',
      amount: product.price,
      currency: product.currency,
      status: 'pending',
    });

    // Generate payment code
    const pixResponse = await ArkamaService.createPixPayment({
      amount: product.price,
      currency: product.currency,
      description: `${model.name} - ${product.name}`,
      externalId: transaction._id.toString(),
    });

    if (!pixResponse.success || !pixResponse.data) {
      purchase.status = 'failed';
      await purchase.save();
      transaction.status = 'failed';
      transaction.failureReason = pixResponse.error;
      await transaction.save();

      await ctx.reply('❌ Erro ao gerar acesso. Tente novamente.');
      return;
    }

    // Update transaction
    transaction.externalId = pixResponse.data.id;
    transaction.pixKey = pixResponse.data.pixKey;
    transaction.pixQrCode = pixResponse.data.pixQrCode;
    transaction.pixCopyPaste = pixResponse.data.pixCopyPaste;
    transaction.pixExpiresAt = pixResponse.data.expiresAt;
    transaction.status = 'processing';
    await transaction.save();

    purchase.transactionId = transaction._id;
    await purchase.save();

    const price = formatPrice(product.price, product.currency);
    const expiresIn = Math.ceil((pixResponse.data.expiresAt.getTime() - Date.now()) / 60000);

    const keyboard = new InlineKeyboard()
      .text('✅ Ja transferi', `check_${purchase._id}`)
      .row()
      .text('❌ Cancelar', 'cancel');

    await ctx.reply(
      `<b>💳 Finalizar Compra</b>\n\n` +
        `📦 ${escapeHtml(product.name)}\n` +
        `💰 <b>${price}</b>\n` +
        `⏰ Expira em ${expiresIn} min\n\n` +
        `<b>Codigo:</b>\n<code>${pixResponse.data.pixCopyPaste}</code>\n\n` +
        `👆 Toque no codigo para copiar\nCole no app do seu banco`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
  } catch (error) {
    logger.error('Error processing checkout', { error });
    await ctx.reply('❌ Erro ao processar. Tente novamente.');
  }
}

// ============ 7. CHECK PAYMENT ============

async function checkPaymentStatus(ctx: Context, purchaseId: string) {
  try {
    const purchase = await PurchaseModel.findById(purchaseId);
    if (!purchase) {
      await ctx.reply('Compra nao encontrada.');
      return;
    }

    const transaction = await TransactionModel.findById(purchase.transactionId);
    if (!transaction || !transaction.externalId) {
      await ctx.reply('Transacao nao encontrada.');
      return;
    }

    const statusResponse = await ArkamaService.checkPaymentStatus({
      paymentId: transaction.externalId,
    });

    if (statusResponse.success && statusResponse.data) {
      const status = statusResponse.data.status;

      if (status === 'paid') {
        transaction.status = 'paid';
        transaction.paidAt = statusResponse.data.paidAt || new Date();
        await transaction.save();

        purchase.status = 'paid';
        await purchase.save();

        await TelegramUserModel.findOneAndUpdate(
          { telegramId: purchase.telegramUserId },
          { $inc: { totalPurchases: 1, totalSpent: purchase.amount } }
        );

        const model = await OFModel.findById(purchase.modelId);

        const keyboard = new InlineKeyboard()
          .text('🔥 Ver mais conteudo', 'back_to_models');

        await ctx.reply(
          `🎉 <b>Acesso Liberado!</b>\n\n` +
            `📦 ${escapeHtml(purchase.productSnapshot.name)}\n` +
            `👤 ${model?.name || 'N/A'}\n\n` +
            `<i>Seu conteudo sera enviado em instantes</i>`,
          { parse_mode: 'HTML', reply_markup: keyboard }
        );
        return;
      } else if (status === 'expired') {
        transaction.status = 'expired';
        await transaction.save();
        purchase.status = 'expired';
        await purchase.save();

        const keyboard = new InlineKeyboard()
          .text('🔄 Tentar novamente', 'back_to_models');

        await ctx.reply(
          '⏰ <b>Tempo esgotado</b>\n\nO codigo expirou. Tente novamente.',
          { parse_mode: 'HTML', reply_markup: keyboard }
        );
        return;
      }
    }

    // Still pending
    const keyboard = new InlineKeyboard()
      .text('✅ Ja transferi', `check_${purchaseId}`)
      .row()
      .text('❌ Cancelar', 'cancel');

    await ctx.reply(
      '⏳ <b>Aguardando...</b>\n\nAinda nao identificamos. Se ja transferiu, aguarde alguns segundos.',
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
  } catch (error) {
    logger.error('Error checking payment', { error });
    await ctx.reply('Erro ao verificar. Tente novamente.');
  }
}

// ============ 8. CANCEL ============

async function cancelPurchase(ctx: Context) {
  const keyboard = new InlineKeyboard()
    .text('🔥 Ver modelos', 'back_to_models');

  await ctx.reply('❌ Cancelado.\n\nVolte quando quiser!', { reply_markup: keyboard });
}

// ============ 9. HISTORY ============

async function showPurchaseHistory(ctx: Context) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Erro: usuario nao identificado.');
      return;
    }

    const purchases = await PurchaseModel.find({
      telegramUserId: userId,
      status: { $in: ['paid', 'completed'] },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('modelId', 'name');

    const keyboard = new InlineKeyboard()
      .text('🔥 Ver modelos', 'back_to_models');

    if (purchases.length === 0) {
      await ctx.reply(
        '<b>📋 Minhas Compras</b>\n\nVoce ainda nao fez nenhuma compra.',
        { parse_mode: 'HTML', reply_markup: keyboard }
      );
      return;
    }

    let message = '<b>📋 Minhas Compras</b>\n\n';

    purchases.forEach((purchase, idx) => {
      const date = purchase.createdAt.toLocaleDateString('pt-BR');
      const price = formatPrice(purchase.amount, purchase.currency);
      const model = purchase.modelId as unknown as { name: string };

      message += `${idx + 1}. <b>${escapeHtml(purchase.productSnapshot.name)}</b>\n`;
      message += `   👤 ${model?.name || 'N/A'}\n`;
      message += `   💰 ${price} • ${date}\n\n`;
    });

    await ctx.reply(message, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (error) {
    logger.error('Error showing history', { error });
    await ctx.reply('Erro ao carregar. Tente novamente.');
  }
}
