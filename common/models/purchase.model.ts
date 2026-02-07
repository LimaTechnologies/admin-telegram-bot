import { Schema, model, models, Model } from 'mongoose';
import type { IPurchase, PurchaseStatus } from '$types/purchase';

const purchaseSchema = new Schema<IPurchase>(
  {
    // Buyer info (Telegram user)
    telegramUserId: {
      type: Number,
      required: true,
      index: true,
    },
    telegramUsername: {
      type: String,
      trim: true,
    },
    telegramFirstName: {
      type: String,
      trim: true,
    },

    // What was purchased
    modelId: {
      type: Schema.Types.ObjectId,
      ref: 'OFModel',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    productSnapshot: {
      name: { type: String, required: true },
      type: { type: String, required: true },
      price: { type: Number, required: true },
      currency: { type: String, required: true },
    },

    // Payment
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
      enum: ['pending', 'paid', 'completed', 'failed', 'refunded', 'expired'] as PurchaseStatus[],
      default: 'pending',
      index: true,
    },

    // Transaction reference
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
    },

    // Delivery
    deliveredAt: Date,
    accessExpiresAt: Date,

    // Metadata
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
purchaseSchema.index({ telegramUserId: 1, createdAt: -1 });
purchaseSchema.index({ modelId: 1, status: 1 });
purchaseSchema.index({ status: 1, createdAt: -1 });

export const PurchaseModel: Model<IPurchase> =
  models['Purchase'] || model<IPurchase>('Purchase', purchaseSchema);
