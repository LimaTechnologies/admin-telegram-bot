import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@common/db';
import { TransactionModel, PurchaseModel, TelegramUserModel, OFModel } from '@common/models';
import { getBotApi, logger } from '@common';
import crypto from 'crypto';

// Arkama webhook secret for signature validation
const ARKAMA_WEBHOOK_SECRET = process.env['ARKAMA_WEBHOOK_SECRET'] || '';

interface ArkamaWebhookPayload {
  event: 'payment.confirmed' | 'payment.failed' | 'payment.expired';
  payment: {
    id: string;
    externalId: string;
    status: 'paid' | 'failed' | 'expired';
    amount: number;
    paidAt?: string;
  };
  signature?: string;
}

// Validate webhook signature
function validateSignature(payload: string, signature: string): boolean {
  if (!ARKAMA_WEBHOOK_SECRET) {
    logger.warn('Arkama webhook secret not configured, skipping validation');
    return true;
  }

  const expectedSignature = crypto
    .createHmac('sha256', ARKAMA_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Deliver content to user via Telegram
async function deliverContent(purchaseId: string): Promise<void> {
  try {
    const purchase = await PurchaseModel.findById(purchaseId);
    if (!purchase) {
      logger.error('Purchase not found for delivery', { purchaseId });
      return;
    }

    const model = await OFModel.findById(purchase.modelId);
    if (!model) {
      logger.error('Model not found for delivery', { modelId: purchase.modelId });
      return;
    }

    const product = model.products.find((p) => p._id.toString() === purchase.productId?.toString());
    if (!product) {
      logger.error('Product not found for delivery', { productId: purchase.productId });
      return;
    }

    const bot = await getBotApi();

    // Success message
    await bot.sendMessage(
      purchase.telegramUserId,
      `🎉 <b>Acesso Liberado!</b>\n\n` +
        `📦 ${purchase.productSnapshot.name}\n` +
        `👤 ${model.name}\n\n` +
        `<i>Seu conteudo exclusivo esta logo abaixo:</i>`,
      { parse_mode: 'HTML' }
    );

    // Deliver content photos
    const photos = product.contentPhotos || [];

    if (photos.length > 0) {
      // Send in batches of 10 (Telegram limit)
      for (let i = 0; i < photos.length; i += 10) {
        const batch = photos.slice(i, i + 10);

        if (batch.length === 1) {
          await bot.sendPhoto(purchase.telegramUserId, batch[0]);
        } else {
          const mediaGroup = batch.map((photo) => ({
            type: 'photo' as const,
            media: photo.startsWith('http') ? photo : `${process.env['S3_PUBLIC_URL']}/${photo}`,
          }));
          await bot.sendMediaGroup(purchase.telegramUserId, mediaGroup);
        }
      }

      await bot.sendMessage(
        purchase.telegramUserId,
        `✅ <b>${photos.length} fotos enviadas!</b>\n\nAproveite seu conteudo exclusivo.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '🔥 Ver mais conteudo', callback_data: 'back_to_models' }]],
          },
        }
      );
    }

    logger.info('Content delivered via webhook', { purchaseId, photosCount: photos.length });
  } catch (error) {
    logger.error('Error delivering content via webhook', { error, purchaseId });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const payload = await request.text();
    const data: ArkamaWebhookPayload = JSON.parse(payload);

    logger.info('Arkama webhook received', { event: data.event, paymentId: data.payment?.id });

    // Validate signature if provided
    const signature = request.headers.get('x-arkama-signature') || data.signature;
    if (signature && !validateSignature(payload, signature)) {
      logger.warn('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Find transaction by external ID
    const transaction = await TransactionModel.findOne({
      externalId: data.payment.id,
    });

    if (!transaction) {
      logger.warn('Transaction not found for webhook', { paymentId: data.payment.id });
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Find purchase
    const purchase = await PurchaseModel.findById(transaction.purchaseId);
    if (!purchase) {
      logger.warn('Purchase not found for webhook', { transactionId: transaction._id });
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    // Process based on event type
    switch (data.event) {
      case 'payment.confirmed': {
        if (transaction.status === 'paid') {
          logger.info('Payment already processed', { paymentId: data.payment.id });
          return NextResponse.json({ message: 'Already processed' });
        }

        // Update transaction
        transaction.status = 'paid';
        transaction.paidAt = data.payment.paidAt ? new Date(data.payment.paidAt) : new Date();
        await transaction.save();

        // Update purchase
        purchase.status = 'paid';
        await purchase.save();

        // Update user stats
        await TelegramUserModel.findOneAndUpdate(
          { telegramId: purchase.telegramUserId },
          { $inc: { totalPurchases: 1, totalSpent: purchase.amount } }
        );

        // Deliver content
        await deliverContent(purchase._id.toString());

        logger.info('Payment confirmed via webhook', {
          paymentId: data.payment.id,
          purchaseId: purchase._id,
        });

        return NextResponse.json({ message: 'Payment confirmed, content delivered' });
      }

      case 'payment.failed': {
        transaction.status = 'failed';
        transaction.failureReason = 'Payment failed via webhook';
        await transaction.save();

        purchase.status = 'failed';
        await purchase.save();

        logger.info('Payment failed via webhook', { paymentId: data.payment.id });

        return NextResponse.json({ message: 'Payment failure recorded' });
      }

      case 'payment.expired': {
        transaction.status = 'expired';
        await transaction.save();

        purchase.status = 'expired';
        await purchase.save();

        logger.info('Payment expired via webhook', { paymentId: data.payment.id });

        return NextResponse.json({ message: 'Payment expiration recorded' });
      }

      default:
        logger.warn('Unknown webhook event', { event: data.event });
        return NextResponse.json({ error: 'Unknown event' }, { status: 400 });
    }
  } catch (error) {
    logger.error('Webhook processing error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Health check for webhook endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'arkama-webhook',
    events: ['payment.confirmed', 'payment.failed', 'payment.expired'],
  });
}
