import { Job } from 'bullmq';
import { PurchaseModel, OFModel, getBotApi, logger } from '@common';

// Job types for subscription processing
type SubscriptionJobType = 'check-expiring-7days' | 'check-expiring-1day' | 'process-expired';

interface SubscriptionJobData {
  type: SubscriptionJobType;
}

export async function processSubscriptionCheck(job: Job<SubscriptionJobData>): Promise<void> {
  const { type } = job.data;

  switch (type) {
    case 'check-expiring-7days':
      await checkExpiringIn7Days();
      break;
    case 'check-expiring-1day':
      await checkExpiringIn1Day();
      break;
    case 'process-expired':
      await processExpiredSubscriptions();
      break;
    default:
      logger.warn('Unknown subscription job type', { type });
  }
}

// ============ CHECK EXPIRING IN 7 DAYS ============

async function checkExpiringIn7Days(): Promise<void> {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    // Find subscriptions expiring within 7 days that haven't been notified
    const expiringPurchases = await PurchaseModel.find({
      status: 'completed',
      'productSnapshot.type': 'subscription',
      accessExpiresAt: { $lte: in7Days, $gt: now },
      expirationNotified7Days: { $ne: true },
    }).populate('modelId', 'name');

    logger.info('Found subscriptions expiring in 7 days', { count: expiringPurchases.length });

    const api = await getBotApi();

    for (const purchase of expiringPurchases) {
      try {
        const model = purchase.modelId as unknown as { name: string };
        const modelName = model?.name || 'a modelo';

        // Send 7-day warning notification
        const message =
          `<b>Sua assinatura com ${escapeHtml(modelName)} expira em 7 dias!</b>\n\n` +
          `Para continuar tendo acesso ao conteudo exclusivo, renove sua assinatura.\n\n` +
          `Use /start para renovar`;

        await api.sendMessage(purchase.telegramUserId, message, { parse_mode: 'HTML' });

        // Mark as notified
        purchase.expirationNotified7Days = true;
        await purchase.save();

        logger.info('Sent 7-day expiration notification', {
          purchaseId: purchase._id,
          userId: purchase.telegramUserId,
        });

        // Rate limiting: wait 100ms between messages
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        logger.error('Failed to send 7-day notification', {
          error,
          purchaseId: purchase._id,
          userId: purchase.telegramUserId,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to check expiring subscriptions (7 days)', { error });
    throw error;
  }
}

// ============ CHECK EXPIRING IN 1 DAY ============

async function checkExpiringIn1Day(): Promise<void> {
  const now = new Date();
  const in1Day = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  try {
    // Find subscriptions expiring within 1 day that haven't been notified
    const expiringPurchases = await PurchaseModel.find({
      status: 'completed',
      'productSnapshot.type': 'subscription',
      accessExpiresAt: { $lte: in1Day, $gt: now },
      expirationNotified1Day: { $ne: true },
    }).populate('modelId', 'name');

    logger.info('Found subscriptions expiring in 1 day', { count: expiringPurchases.length });

    const api = await getBotApi();

    for (const purchase of expiringPurchases) {
      try {
        const model = purchase.modelId as unknown as { name: string };
        const modelName = model?.name || 'a modelo';

        // Send 1-day warning notification
        const message =
          `<b>Sua assinatura com ${escapeHtml(modelName)} expira amanha!</b>\n\n` +
          `Nao perca seu acesso ao conteudo exclusivo.\n\n` +
          `Use /start para renovar agora`;

        await api.sendMessage(purchase.telegramUserId, message, { parse_mode: 'HTML' });

        // Mark as notified
        purchase.expirationNotified1Day = true;
        await purchase.save();

        logger.info('Sent 1-day expiration notification', {
          purchaseId: purchase._id,
          userId: purchase.telegramUserId,
        });

        // Rate limiting: wait 100ms between messages
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        logger.error('Failed to send 1-day notification', {
          error,
          purchaseId: purchase._id,
          userId: purchase.telegramUserId,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to check expiring subscriptions (1 day)', { error });
    throw error;
  }
}

// ============ PROCESS EXPIRED SUBSCRIPTIONS ============

async function processExpiredSubscriptions(): Promise<void> {
  const now = new Date();

  try {
    // Find expired subscriptions that are still completed (not yet expired status)
    const expiredPurchases = await PurchaseModel.find({
      status: 'completed',
      'productSnapshot.type': 'subscription',
      accessExpiresAt: { $lte: now },
    });

    logger.info('Found expired subscriptions', { count: expiredPurchases.length });

    const api = await getBotApi();

    for (const purchase of expiredPurchases) {
      try {
        // Delete content messages
        const sentMessages = purchase.sentMessages || [];
        let deletedCount = 0;

        for (const { chatId, messageIds } of sentMessages) {
          for (const messageId of messageIds) {
            try {
              await api.deleteMessage(chatId, messageId);
              deletedCount++;
              // Rate limiting: wait 50ms between deletes
              await new Promise((resolve) => setTimeout(resolve, 50));
            } catch (deleteError) {
              // Message may already be deleted or chat not accessible
              logger.debug('Could not delete message', {
                chatId,
                messageId,
                error: deleteError,
              });
            }
          }
        }

        // Update purchase status to expired
        purchase.status = 'expired';
        purchase.sentMessages = []; // Clear sent messages for privacy
        await purchase.save();

        logger.info('Processed expired subscription', {
          purchaseId: purchase._id,
          userId: purchase.telegramUserId,
          deletedMessages: deletedCount,
        });
      } catch (error) {
        logger.error('Failed to process expired subscription', {
          error,
          purchaseId: purchase._id,
          userId: purchase.telegramUserId,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to process expired subscriptions', { error });
    throw error;
  }
}

// ============ HELPER ============

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
