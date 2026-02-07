import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, operatorProcedure } from '../trpc';
import { withAudit } from '../middleware/audit.middleware';
import { OFModel, PurchaseModel, TransactionModel, TelegramUserModel } from '@common';
import { ArkamaService } from '@common/services/arkama.service';

export const purchaseRouter = router({
  // List purchases (dashboard)
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        status: z.enum(['pending', 'paid', 'completed', 'failed', 'refunded', 'expired']).optional(),
        modelId: z.string().optional(),
        telegramUserId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const { page, limit, status, modelId, telegramUserId } = input;

      const filter: Record<string, unknown> = {};
      if (status) filter['status'] = status;
      if (modelId) filter['modelId'] = modelId;
      if (telegramUserId) filter['telegramUserId'] = telegramUserId;

      const [purchases, total] = await Promise.all([
        PurchaseModel.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('modelId', 'name username')
          .select('-__v'),
        PurchaseModel.countDocuments(filter),
      ]);

      return {
        data: purchases.map((p) => p.toObject()),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  // Get purchase by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const purchase = await PurchaseModel.findById(input.id)
        .populate('modelId', 'name username')
        .populate('transactionId')
        .select('-__v');

      if (!purchase) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase not found' });
      }

      return purchase.toObject();
    }),

  // Create purchase (from bot)
  create: protectedProcedure
    .input(
      z.object({
        telegramUserId: z.number(),
        telegramUsername: z.string().optional(),
        telegramFirstName: z.string().optional(),
        modelId: z.string(),
        productId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Get model and product
      const model = await OFModel.findById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Model not found' });
      }

      const product = model.products.find(
        (p) => p._id.toString() === input.productId && p.isActive
      );
      if (!product) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });
      }

      // Create or update telegram user
      await TelegramUserModel.findOneAndUpdate(
        { telegramId: input.telegramUserId },
        {
          telegramId: input.telegramUserId,
          username: input.telegramUsername,
          firstName: input.telegramFirstName,
        },
        { upsert: true }
      );

      // Create purchase
      const purchase = await PurchaseModel.create({
        telegramUserId: input.telegramUserId,
        telegramUsername: input.telegramUsername,
        telegramFirstName: input.telegramFirstName,
        modelId: input.modelId,
        productId: input.productId,
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

      return purchase.toObject();
    }),

  // Create PIX payment for purchase
  createPayment: protectedProcedure
    .input(
      z.object({
        purchaseId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const purchase = await PurchaseModel.findById(input.purchaseId);
      if (!purchase) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase not found' });
      }

      if (purchase.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Purchase is not pending',
        });
      }

      // Create transaction
      const transaction = await TransactionModel.create({
        purchaseId: purchase._id,
        paymentMethod: 'pix',
        amount: purchase.amount,
        currency: purchase.currency,
        status: 'pending',
      });

      // Create PIX payment via Arkama
      const pixResponse = await ArkamaService.createPixPayment({
        amount: purchase.amount,
        currency: purchase.currency,
        description: `Compra: ${purchase.productSnapshot.name}`,
        externalId: transaction._id.toString(),
      });

      if (!pixResponse.success || !pixResponse.data) {
        transaction.status = 'failed';
        transaction.failureReason = pixResponse.error || 'Failed to create PIX';
        await transaction.save();

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create payment',
        });
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

      return {
        purchaseId: purchase._id.toString(),
        transactionId: transaction._id.toString(),
        pixQrCode: pixResponse.data.pixQrCode,
        pixCopyPaste: pixResponse.data.pixCopyPaste,
        expiresAt: pixResponse.data.expiresAt,
        amount: purchase.amount,
        currency: purchase.currency,
      };
    }),

  // Check payment status
  checkPaymentStatus: protectedProcedure
    .input(z.object({ purchaseId: z.string() }))
    .query(async ({ input }) => {
      const purchase = await PurchaseModel.findById(input.purchaseId).populate(
        'transactionId'
      );
      if (!purchase) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase not found' });
      }

      const transaction = purchase.transactionId as unknown as {
        _id: string;
        externalId?: string;
        status: string;
        paidAt?: Date;
      };

      if (!transaction || !transaction.externalId) {
        return {
          purchaseId: purchase._id.toString(),
          status: purchase.status,
          isPaid: false,
        };
      }

      // Check with Arkama
      const statusResponse = await ArkamaService.checkPaymentStatus({
        paymentId: transaction.externalId,
      });

      if (statusResponse.success && statusResponse.data) {
        const arkamaStatus = statusResponse.data.status;

        // Update transaction if status changed
        if (arkamaStatus === 'paid' && transaction.status !== 'paid') {
          await TransactionModel.findByIdAndUpdate(transaction._id, {
            status: 'paid',
            paidAt: statusResponse.data.paidAt || new Date(),
          });

          // Update purchase
          purchase.status = 'paid';
          await purchase.save();

          // Update telegram user stats
          await TelegramUserModel.findOneAndUpdate(
            { telegramId: purchase.telegramUserId },
            {
              $inc: {
                totalPurchases: 1,
                totalSpent: purchase.amount,
              },
            }
          );
        } else if (arkamaStatus === 'expired' && transaction.status !== 'expired') {
          await TransactionModel.findByIdAndUpdate(transaction._id, {
            status: 'expired',
          });
          purchase.status = 'expired';
          await purchase.save();
        }

        return {
          purchaseId: purchase._id.toString(),
          status: arkamaStatus,
          isPaid: arkamaStatus === 'paid',
          paidAt: statusResponse.data.paidAt,
        };
      }

      return {
        purchaseId: purchase._id.toString(),
        status: purchase.status,
        isPaid: purchase.status === 'paid' || purchase.status === 'completed',
      };
    }),

  // Get user purchase history (for bot)
  getUserHistory: protectedProcedure
    .input(
      z.object({
        telegramUserId: z.number(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const { telegramUserId, page, limit } = input;

      const [purchases, total] = await Promise.all([
        PurchaseModel.find({
          telegramUserId,
          status: { $in: ['paid', 'completed'] },
        })
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('modelId', 'name username'),
        PurchaseModel.countDocuments({
          telegramUserId,
          status: { $in: ['paid', 'completed'] },
        }),
      ]);

      return {
        data: purchases.map((p) => p.toObject()),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  // Mark purchase as completed (after delivery)
  complete: operatorProcedure
    .input(z.object({ id: z.string() }))
    .use(
      withAudit({
        action: 'purchase.complete',
        entityType: 'purchase',
        getEntityId: (input) => (input as { id: string }).id,
      })
    )
    .mutation(async ({ input }) => {
      const purchase = await PurchaseModel.findByIdAndUpdate(
        input.id,
        { status: 'completed', deliveredAt: new Date() },
        { new: true }
      );

      if (!purchase) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase not found' });
      }

      return purchase.toObject();
    }),

  // Refund purchase
  refund: operatorProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().optional(),
      })
    )
    .use(
      withAudit({
        action: 'purchase.refund',
        entityType: 'purchase',
        getEntityId: (input) => (input as { id: string }).id,
      })
    )
    .mutation(async ({ input }) => {
      const purchase = await PurchaseModel.findById(input.id);
      if (!purchase) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase not found' });
      }

      if (!['paid', 'completed'].includes(purchase.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only paid or completed purchases can be refunded',
        });
      }

      // Update purchase
      purchase.status = 'refunded';
      purchase.notes = input.reason || 'Refunded by operator';
      await purchase.save();

      // Update transaction
      if (purchase.transactionId) {
        await TransactionModel.findByIdAndUpdate(purchase.transactionId, {
          status: 'refunded',
          refundedAt: new Date(),
          refundReason: input.reason,
        });
      }

      // Decrement user stats
      await TelegramUserModel.findOneAndUpdate(
        { telegramId: purchase.telegramUserId },
        {
          $inc: {
            totalPurchases: -1,
            totalSpent: -purchase.amount,
          },
        }
      );

      return purchase.toObject();
    }),

  // Get purchase stats
  getStats: protectedProcedure.query(async () => {
    const [totalStats, statusStats, recentStats] = await Promise.all([
      // Total stats
      PurchaseModel.aggregate([
        { $match: { status: { $in: ['paid', 'completed'] } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            revenue: { $sum: '$amount' },
          },
        },
      ]),
      // Stats by status
      PurchaseModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Last 24h
      PurchaseModel.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            status: { $in: ['paid', 'completed'] },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            revenue: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const byStatus: Record<string, number> = {};
    statusStats.forEach((s) => {
      byStatus[s._id] = s.count;
    });

    return {
      total: totalStats[0]?.total || 0,
      totalRevenue: totalStats[0]?.revenue || 0,
      byStatus,
      last24h: {
        count: recentStats[0]?.count || 0,
        revenue: recentStats[0]?.revenue || 0,
      },
    };
  }),
});
