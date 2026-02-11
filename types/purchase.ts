import { Types } from 'mongoose';

// Model Product - item for sale within a model's profile
export interface IModelProduct {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  type: 'subscription' | 'content' | 'ppv' | 'custom';
  price: number;
  currency: 'BRL' | 'USD';
  previewImages: string[]; // S3 keys
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateModelProductInput {
  name: string;
  description?: string;
  type: 'subscription' | 'content' | 'ppv' | 'custom';
  price: number;
  currency?: 'BRL' | 'USD';
  previewImages?: string[];
}

export interface UpdateModelProductInput extends Partial<CreateModelProductInput> {
  isActive?: boolean;
}

// Sent message tracking for subscription expiration
export interface ISentMessage {
  chatId: number;
  messageIds: number[];
}

// Purchase - when a user buys a product
export type PurchaseStatus = 'pending' | 'paid' | 'completed' | 'failed' | 'refunded' | 'expired';

export interface IPurchase {
  _id: Types.ObjectId;

  // Buyer info (Telegram user)
  telegramUserId: number;
  telegramUsername?: string;
  telegramFirstName?: string;

  // What was purchased
  modelId: Types.ObjectId;
  productId: Types.ObjectId;
  productSnapshot: {
    name: string;
    type: string;
    price: number;
    currency: string;
  };

  // Payment
  amount: number;
  currency: 'BRL' | 'USD';
  status: PurchaseStatus;

  // Transaction reference
  transactionId?: Types.ObjectId;

  // Delivery
  deliveredAt?: Date;
  accessExpiresAt?: Date; // For subscriptions

  // Sent messages (for deletion on expiration)
  sentMessages?: ISentMessage[];

  // Expiration notification tracking
  expirationNotified7Days?: boolean;
  expirationNotified1Day?: boolean;

  // Metadata
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePurchaseInput {
  telegramUserId: number;
  telegramUsername?: string;
  telegramFirstName?: string;
  modelId: string;
  productId: string;
}

// Transaction - payment processing record
export type TransactionStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'expired';
export type PaymentMethod = 'pix' | 'credit_card' | 'bank_transfer';

export interface ITransaction {
  _id: Types.ObjectId;

  // Reference
  purchaseId: Types.ObjectId;

  // Payment details
  paymentMethod: PaymentMethod;
  amount: number;
  currency: 'BRL' | 'USD';
  status: TransactionStatus;

  // PIX specific
  pixKey?: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  pixExpiresAt?: Date;

  // External provider (Arkama mock)
  externalId?: string;
  externalResponse?: Record<string, unknown>;

  // Processing
  paidAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  refundedAt?: Date;
  refundReason?: string;

  // Metadata
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTransactionInput {
  purchaseId: string;
  paymentMethod: PaymentMethod;
  amount: number;
  currency: 'BRL' | 'USD';
}

// Telegram User for tracking purchases
export interface ITelegramUser {
  _id: Types.ObjectId;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;

  // Stats
  totalPurchases: number;
  totalSpent: number;

  // Preferences
  isBlocked: boolean;

  createdAt: Date;
  updatedAt: Date;
}
