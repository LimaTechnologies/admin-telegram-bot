import { Bot, InlineKeyboard, Context, InputFile } from 'grammy';
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

function getPhotoUrl(photo: string): string {
  return photo.startsWith('http') ? photo : StorageService.getPublicUrl(photo);
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

// ============ 2. MODEL PROFILE (gallery unified with buttons) ============

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

    // Caption with name, bio
    const caption =
      `${tierEmoji} <b>${escapeHtml(model.name)}</b>\n` +
      `@${escapeHtml(model.username)}\n\n` +
      `${model.bio ? escapeHtml(model.bio) : ''}`;

    const photos = model.previewPhotos || [];

    // Strategy: send N-1 photos as media group, last photo with caption + buttons
    if (photos.length > 1) {
      // Send first photos without buttons (media group limitation)
      const mediaGroup = photos.slice(0, -1).map((photo) => ({
        type: 'photo' as const,
        media: getPhotoUrl(photo),
      }));

      try {
        await ctx.replyWithMediaGroup(mediaGroup);
      } catch (galleryError) {
        logger.error('Gallery failed', { error: galleryError });
      }

      // Last photo with caption and buttons
      try {
        await ctx.replyWithPhoto(getPhotoUrl(photos[photos.length - 1]), {
          caption,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        return;
      } catch {
        // fallback to text
      }
    } else if (photos.length === 1) {
      // Single photo with caption and buttons
      try {
        await ctx.replyWithPhoto(getPhotoUrl(photos[0]), {
          caption,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        return;
      } catch {
        // fallback to text
      }
    }

    // Text fallback
    await ctx.reply(caption, {
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
    const contentCount = pack.contentPhotos?.length || 0;

    const keyboard = new InlineKeyboard()
      .text(`🔓 Liberar Acesso • ${price}`, `buy_${modelId}_${productId}`)
      .row()
      .text('⬅️ Voltar aos packs', `packs_${modelId}`);

    const caption =
      `<b>📦 ${escapeHtml(pack.name)}</b>\n\n` +
      `${pack.description ? escapeHtml(pack.description) + '\n\n' : ''}` +
      `${contentCount > 0 ? `📸 <b>${contentCount} fotos exclusivas</b>\n` : ''}` +
      `💰 <b>${price}</b>\n\n` +
      `<i>Acesso permanente apos a compra</i>`;

    // Send pack preview if available
    if (pack.previewImages && pack.previewImages.length > 0) {
      try {
        await ctx.replyWithPhoto(getPhotoUrl(pack.previewImages[0]), {
          caption,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        return;
      } catch {
        // continue to text
      }
    }

    await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: keyboard });
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

// ============ 6. CHECKOUT (with QR Code image) ============

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

    await ctx.reply('⏳ Gerando codigo...');

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

      await ctx.reply('❌ Erro ao gerar codigo. Tente novamente.');
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

    const caption =
      `<b>💳 Finalizar Compra</b>\n\n` +
      `📦 ${escapeHtml(product.name)}\n` +
      `💰 <b>${price}</b>\n` +
      `⏰ Expira em ${expiresIn} min\n\n` +
      `<b>Codigo Copia e Cola:</b>\n<code>${pixResponse.data.pixCopyPaste}</code>\n\n` +
      `👆 Toque para copiar e cole no app do banco`;

    // Try to send QR code image
    if (pixResponse.data.pixQrCode) {
      try {
        let photoSource: string | InputFile;

        if (pixResponse.data.pixQrCode.startsWith('data:image')) {
          // Base64 image - convert to buffer
          const base64Data = pixResponse.data.pixQrCode.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          photoSource = new InputFile(buffer, 'qrcode.png');
        } else if (pixResponse.data.pixQrCode.startsWith('http')) {
          // URL
          photoSource = pixResponse.data.pixQrCode;
        } else {
          throw new Error('Invalid QR code format');
        }

        await ctx.replyWithPhoto(photoSource, {
          caption,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        return;
      } catch (qrError) {
        logger.error('QR code send failed', { error: qrError });
      }
    }

    // Fallback to text only
    await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (error) {
    logger.error('Error processing checkout', { error });
    await ctx.reply('❌ Erro ao processar. Tente novamente.');
  }
}

// ============ 7. CHECK PAYMENT & DELIVER CONTENT ============

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

        // Deliver the content!
        await deliverContent(ctx, purchase);
        return;
      } else if (status === 'expired') {
        transaction.status = 'expired';
        await transaction.save();
        purchase.status = 'expired';
        await purchase.save();

        const keyboard = new InlineKeyboard().text('🔄 Tentar novamente', 'back_to_models');

        await ctx.reply('⏰ <b>Tempo esgotado</b>\n\nO codigo expirou. Tente novamente.', {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
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

// ============ 8. DELIVER CONTENT ============

async function deliverContent(ctx: Context, purchase: InstanceType<typeof PurchaseModel>) {
  try {
    const model = await OFModel.findById(purchase.modelId);
    if (!model) {
      await ctx.reply('🎉 <b>Acesso Liberado!</b>\n\nErro ao carregar conteudo.', { parse_mode: 'HTML' });
      return;
    }

    const product = model.products.find((p) => p._id.toString() === purchase.productId?.toString());

    const keyboard = new InlineKeyboard().text('🔥 Ver mais conteudo', 'back_to_models');

    // Success message
    await ctx.reply(
      `🎉 <b>Acesso Liberado!</b>\n\n` +
        `📦 ${escapeHtml(purchase.productSnapshot.name)}\n` +
        `👤 ${escapeHtml(model.name)}\n\n` +
        `<i>Seu conteudo exclusivo esta logo abaixo:</i>`,
      { parse_mode: 'HTML' }
    );

    // Deliver content photos
    const photos = product?.contentPhotos || [];

    if (photos.length > 0) {
      // Send in batches of 10 (Telegram limit for media groups)
      for (let i = 0; i < photos.length; i += 10) {
        const batch = photos.slice(i, i + 10);

        if (batch.length === 1) {
          // Single photo
          try {
            await ctx.replyWithPhoto(getPhotoUrl(batch[0]));
          } catch {
            await ctx.reply(`📸 ${getPhotoUrl(batch[0])}`);
          }
        } else {
          // Media group
          const mediaGroup = batch.map((photo) => ({
            type: 'photo' as const,
            media: getPhotoUrl(photo),
          }));

          try {
            await ctx.replyWithMediaGroup(mediaGroup);
          } catch (mediaError) {
            logger.error('Media group failed, sending individually', { error: mediaError });
            for (const photo of batch) {
              try {
                await ctx.replyWithPhoto(getPhotoUrl(photo));
              } catch {
                await ctx.reply(`📸 ${getPhotoUrl(photo)}`);
              }
            }
          }
        }
      }

      await ctx.reply(`✅ <b>${photos.length} fotos enviadas!</b>\n\nAproveite seu conteudo exclusivo.`, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } else {
      // No content photos - just show success
      await ctx.reply(`✅ Compra confirmada!\n\nO conteudo sera enviado em breve.`, { reply_markup: keyboard });
    }
  } catch (error) {
    logger.error('Error delivering content', { error });
    await ctx.reply('🎉 Acesso liberado! O conteudo sera enviado em breve.');
  }
}

// ============ 9. CANCEL ============

async function cancelPurchase(ctx: Context) {
  const keyboard = new InlineKeyboard().text('🔥 Ver modelos', 'back_to_models');

  await ctx.reply('❌ Cancelado.\n\nVolte quando quiser!', { reply_markup: keyboard });
}

// ============ 10. HISTORY ============

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

    const keyboard = new InlineKeyboard().text('🔥 Ver modelos', 'back_to_models');

    if (purchases.length === 0) {
      await ctx.reply('<b>📋 Minhas Compras</b>\n\nVoce ainda nao fez nenhuma compra.', {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
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
