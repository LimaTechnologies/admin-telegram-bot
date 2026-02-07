import { Schema, model, models, Model } from 'mongoose';
import type { ITransaction, TransactionStatus, PaymentMethod } from '$types/purchase';

const transactionSchema = new Schema<ITransaction>(
  {
    // Reference
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: 'Purchase',
      required: true,
      index: true,
    },

    // Payment details
    paymentMethod: {
      type: String,
      enum: ['pix', 'credit_card', 'bank_transfer'] as PaymentMethod[],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      enum: ['BRL', 'USD'],
      default: 'BRL',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'paid', 'failed', 'refunded', 'expired'] as TransactionStatus[],
      default: 'pending',
      index: true,
    },

    // PIX specific
    pixKey: String,
    pixQrCode: String,
    pixCopyPaste: String,
    pixExpiresAt: Date,

    // External provider (Arkama mock)
    externalId: {
      type: String,
    },
    externalResponse: Schema.Types.Mixed,

    // Processing
    paidAt: Date,
    failedAt: Date,
    failureReason: String,
    refundedAt: Date,
    refundReason: String,

    // Metadata
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ externalId: 1 });
transactionSchema.index({ pixExpiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL for expired PIX

export const TransactionModel: Model<ITransaction> =
  models['Transaction'] || model<ITransaction>('Transaction', transactionSchema);
