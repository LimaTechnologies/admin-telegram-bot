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

// Store pending purchases in memory (in production, use Redis)
const pendingPurchases = new Map<
  number,
  {
    modelId: string;
    productId: string;
    purchaseId?: string;
    transactionId?: string;
    step: 'selecting_product' | 'confirming' | 'awaiting_payment';
  }
>();

/**
 * Register purchase-related handlers on the bot
 */
export function registerPurchaseHandlers(bot: Bot) {
  // /models command - List available models
  bot.command('models', async (ctx) => {
    await showModelsList(ctx);
  });

  // /buy command - Start purchase flow
  bot.command('buy', async (ctx) => {
    await ctx.reply(
      'Para comprar, use o comando /models para ver as modelos disponíveis e clique em uma para ver os produtos.'
    );
  });

  // /history command - Show purchase history
  bot.command('history', async (ctx) => {
    await showPurchaseHistory(ctx);
  });

  // Handle callback queries (button clicks)
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data.startsWith('model_')) {
      const modelId = data.replace('model_', '');
      await showModelDetails(ctx, modelId);
    } else if (data.startsWith('product_')) {
      const [, modelId, productId] = data.split('_');
      await showProductConfirmation(ctx, modelId, productId);
    } else if (data.startsWith('confirm_')) {
      const [, modelId, productId] = data.split('_');
      await processPayment(ctx, modelId, productId);
    } else if (data === 'cancel_purchase') {
      await cancelPurchase(ctx);
    } else if (data === 'back_to_models') {
      await showModelsList(ctx);
    } else if (data.startsWith('check_payment_')) {
      const purchaseId = data.replace('check_payment_', '');
      await checkPaymentStatus(ctx, purchaseId);
    }

    // Answer callback to remove loading state
    await ctx.answerCallbackQuery();
  });
}

/**
 * Show list of available models
 */
async function showModelsList(ctx: Context) {
  try {
    const models = await OFModel.find({
      isActive: true,
      'products.0': { $exists: true },
    })
      .sort({ tier: -1 })
      .select('_id name username bio tier previewPhotos products')
      .limit(10);

    if (models.length === 0) {
      await ctx.reply('Nenhuma modelo disponível no momento.');
      return;
    }

    const keyboard = new InlineKeyboard();

    models.forEach((model) => {
      const activeProducts = model.products.filter((p) => p.isActive);
      const tierEmoji = getTierEmoji(model.tier);
      keyboard
        .text(
          `${tierEmoji} ${model.name} (${activeProducts.length} produtos)`,
          `model_${model._id}`
        )
        .row();
    });

    await ctx.reply(
      '🔥 *Modelos Disponíveis*\n\nEscolha uma modelo para ver os produtos:',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  } catch (error) {
    logger.error('Error showing models list', { error });
    await ctx.reply('Erro ao carregar modelos. Tente novamente.');
  }
}

/**
 * Show model details with products
 */
async function showModelDetails(ctx: Context, modelId: string) {
  try {
    const model = await OFModel.findById(modelId).select(
      '_id name username bio tier previewPhotos products onlyfansUrl referralLink'
    );

    if (!model) {
      await ctx.reply('Modelo não encontrada.');
      return;
    }

    const activeProducts = model.products.filter((p) => p.isActive);
    const tierEmoji = getTierEmoji(model.tier);

    // Build message
    let message = `${tierEmoji} *${model.name}* (@${model.username})\n\n`;
    if (model.bio) {
      message += `${model.bio}\n\n`;
    }
    message += `📦 *Produtos Disponíveis:*\n\n`;

    activeProducts.forEach((product, idx) => {
      const price = formatPrice(product.price, product.currency);
      message += `${idx + 1}. *${product.name}*\n   💰 ${price}\n`;
      if (product.description) {
        message += `   📝 ${product.description.substring(0, 50)}...\n`;
      }
      message += '\n';
    });

    // Build keyboard with products
    const keyboard = new InlineKeyboard();
    activeProducts.forEach((product) => {
      const price = formatPrice(product.price, product.currency);
      keyboard
        .text(`💳 ${product.name} - ${price}`, `product_${modelId}_${product._id}`)
        .row();
    });

    // Add OnlyFans link if available
    if (model.referralLink || model.onlyfansUrl) {
      keyboard.url('🔗 Ver OnlyFans', model.referralLink || model.onlyfansUrl).row();
    }

    keyboard.text('⬅️ Voltar', 'back_to_models');

    // Send photo if available
    if (model.previewPhotos && model.previewPhotos.length > 0) {
      const photoUrl = StorageService.getPublicUrl(model.previewPhotos[0]);
      try {
        await ctx.replyWithPhoto(photoUrl, {
          caption: message,
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
        return;
      } catch {
        // Fall back to text if photo fails
      }
    }

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error('Error showing model details', { error, modelId });
    await ctx.reply('Erro ao carregar modelo. Tente novamente.');
  }
}

/**
 * Show product confirmation before payment
 */
async function showProductConfirmation(
  ctx: Context,
  modelId: string,
  productId: string
) {
  try {
    const model = await OFModel.findById(modelId);
    if (!model) {
      await ctx.reply('Modelo não encontrada.');
      return;
    }

    const product = model.products.find((p) => p._id.toString() === productId);
    if (!product) {
      await ctx.reply('Produto não encontrado.');
      return;
    }

    const price = formatPrice(product.price, product.currency);

    const message =
      `🛒 *Confirmar Compra*\n\n` +
      `*Modelo:* ${model.name}\n` +
      `*Produto:* ${product.name}\n` +
      `*Valor:* ${price}\n\n` +
      `Ao confirmar, você receberá um PIX para pagamento.`;

    const keyboard = new InlineKeyboard()
      .text('✅ Confirmar e Pagar', `confirm_${modelId}_${productId}`)
      .row()
      .text('❌ Cancelar', 'cancel_purchase');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error('Error showing product confirmation', { error });
    await ctx.reply('Erro ao processar. Tente novamente.');
  }
}

/**
 * Process payment - Create purchase and PIX
 */
async function processPayment(ctx: Context, modelId: string, productId: string) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Erro: usuário não identificado.');
      return;
    }

    // Get model and product
    const model = await OFModel.findById(modelId);
    if (!model) {
      await ctx.reply('Modelo não encontrada.');
      return;
    }

    const product = model.products.find((p) => p._id.toString() === productId);
    if (!product || !product.isActive) {
      await ctx.reply('Produto não disponível.');
      return;
    }

    await ctx.reply('⏳ Gerando pagamento PIX...');

    // Create or update telegram user
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

    // Create PIX via Arkama
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

      await ctx.reply('❌ Erro ao gerar pagamento. Tente novamente.');
      return;
    }

    // Update transaction with PIX data
    transaction.externalId = pixResponse.data.id;
    transaction.pixKey = pixResponse.data.pixKey;
    transaction.pixQrCode = pixResponse.data.pixQrCode;
    transaction.pixCopyPaste = pixResponse.data.pixCopyPaste;
    transaction.pixExpiresAt = pixResponse.data.expiresAt;
    transaction.status = 'processing';
    await transaction.save();

    // Update purchase with transaction reference
    purchase.transactionId = transaction._id;
    await purchase.save();

    // Send PIX details to user
    const price = formatPrice(product.price, product.currency);
    const expiresIn = Math.ceil(
      (pixResponse.data.expiresAt.getTime() - Date.now()) / 60000
    );

    const paymentMessage =
      `✅ *Pagamento PIX Gerado*\n\n` +
      `*Valor:* ${price}\n` +
      `*Expira em:* ${expiresIn} minutos\n\n` +
      `📋 *PIX Copia e Cola:*\n` +
      `\`${pixResponse.data.pixCopyPaste}\`\n\n` +
      `Copie o código acima e cole no seu app de banco.\n\n` +
      `⏳ O pagamento será confirmado automaticamente em alguns segundos.`;

    const keyboard = new InlineKeyboard()
      .text('🔄 Verificar Pagamento', `check_payment_${purchase._id}`)
      .row()
      .text('❌ Cancelar', 'cancel_purchase');

    await ctx.reply(paymentMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error('Error processing payment', { error });
    await ctx.reply('❌ Erro ao processar pagamento. Tente novamente.');
  }
}

/**
 * Check payment status
 */
async function checkPaymentStatus(ctx: Context, purchaseId: string) {
  try {
    const purchase = await PurchaseModel.findById(purchaseId);
    if (!purchase) {
      await ctx.reply('Compra não encontrada.');
      return;
    }

    const transaction = await TransactionModel.findById(purchase.transactionId);
    if (!transaction || !transaction.externalId) {
      await ctx.reply('Transação não encontrada.');
      return;
    }

    // Check with Arkama
    const statusResponse = await ArkamaService.checkPaymentStatus({
      paymentId: transaction.externalId,
    });

    if (statusResponse.success && statusResponse.data) {
      const status = statusResponse.data.status;

      if (status === 'paid') {
        // Update records
        transaction.status = 'paid';
        transaction.paidAt = statusResponse.data.paidAt || new Date();
        await transaction.save();

        purchase.status = 'paid';
        await purchase.save();

        // Update user stats
        await TelegramUserModel.findOneAndUpdate(
          { telegramId: purchase.telegramUserId },
          {
            $inc: {
              totalPurchases: 1,
              totalSpent: purchase.amount,
            },
          }
        );

        // Get model info for confirmation
        const model = await OFModel.findById(purchase.modelId);

        await ctx.reply(
          `✅ *Pagamento Confirmado!*\n\n` +
            `Obrigado pela sua compra!\n\n` +
            `*Produto:* ${purchase.productSnapshot.name}\n` +
            `*Modelo:* ${model?.name || 'N/A'}\n\n` +
            `Seu acesso será liberado em breve. Use /history para ver suas compras.`,
          { parse_mode: 'Markdown' }
        );
        return;
      } else if (status === 'expired') {
        transaction.status = 'expired';
        await transaction.save();
        purchase.status = 'expired';
        await purchase.save();

        await ctx.reply(
          '⏰ *Pagamento Expirado*\n\nO tempo para pagamento expirou. Use /models para iniciar uma nova compra.',
          { parse_mode: 'Markdown' }
        );
        return;
      }
    }

    // Still pending
    const keyboard = new InlineKeyboard()
      .text('🔄 Verificar Novamente', `check_payment_${purchaseId}`)
      .row()
      .text('❌ Cancelar', 'cancel_purchase');

    await ctx.reply(
      '⏳ *Aguardando Pagamento*\n\nAinda não recebemos o pagamento. Verifique se o PIX foi enviado corretamente.',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  } catch (error) {
    logger.error('Error checking payment status', { error });
    await ctx.reply('Erro ao verificar pagamento. Tente novamente.');
  }
}

/**
 * Cancel purchase
 */
async function cancelPurchase(ctx: Context) {
  const userId = ctx.from?.id;
  if (userId) {
    pendingPurchases.delete(userId);
  }

  await ctx.reply(
    '❌ Compra cancelada.\n\nUse /models para ver as modelos disponíveis.',
    { parse_mode: 'Markdown' }
  );
}

/**
 * Show purchase history
 */
async function showPurchaseHistory(ctx: Context) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Erro: usuário não identificado.');
      return;
    }

    const purchases = await PurchaseModel.find({
      telegramUserId: userId,
      status: { $in: ['paid', 'completed'] },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('modelId', 'name username');

    if (purchases.length === 0) {
      await ctx.reply(
        '📋 *Histórico de Compras*\n\nVocê ainda não fez nenhuma compra.\n\nUse /models para ver as modelos disponíveis.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let message = '📋 *Histórico de Compras*\n\n';

    purchases.forEach((purchase, idx) => {
      const date = purchase.createdAt.toLocaleDateString('pt-BR');
      const price = formatPrice(purchase.amount, purchase.currency);
      const model = purchase.modelId as unknown as { name: string };
      const statusEmoji = purchase.status === 'completed' ? '✅' : '💰';

      message +=
        `${idx + 1}. ${statusEmoji} *${purchase.productSnapshot.name}*\n` +
        `   Modelo: ${model?.name || 'N/A'}\n` +
        `   Valor: ${price}\n` +
        `   Data: ${date}\n\n`;
    });

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Error showing purchase history', { error });
    await ctx.reply('Erro ao carregar histórico. Tente novamente.');
  }
}

// Helper functions
function getTierEmoji(tier: string): string {
  const emojis: Record<string, string> = {
    platinum: '💎',
    gold: '🥇',
    silver: '🥈',
    bronze: '🥉',
  };
  return emojis[tier] || '⭐';
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(price);
}
