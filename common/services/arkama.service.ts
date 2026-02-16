/**
 * Arkama Payment Service
 * Integrates with Arkama API for PIX payment processing
 * Docs: https://arkama.readme.io/reference/intro
 */

import axios, { type AxiosInstance } from 'axios';
import { logger } from './logger';
import { randomBytes } from 'crypto';

// API Configuration
const ARKAMA_API_URL = process.env['ARKAMA_API_URL'] || 'https://sandbox.arkama.com.br/api/v1';
const ARKAMA_API_KEY = process.env['ARKAMA_API_KEY'] || '';

export interface CreatePixPaymentInput {
  amount: number;
  currency: 'BRL' | 'USD';
  description: string;
  externalId: string; // Our transaction ID
  customer?: {
    name?: string;
    email?: string;
    document?: string; // CPF
  };
}

export interface PixPaymentResponse {
  success: boolean;
  data?: {
    id: string; // Arkama transaction ID
    pixKey: string;
    pixQrCode: string; // Base64 encoded QR code or URL
    pixCopyPaste: string; // PIX copia e cola (payload)
    expiresAt: Date;
    amount: number;
    currency: string;
  };
  error?: string;
}

export interface CheckPaymentStatusInput {
  paymentId: string;
}

export interface PaymentStatusResponse {
  success: boolean;
  data?: {
    id: string;
    status: 'pending' | 'processing' | 'paid' | 'failed' | 'expired';
    paidAt?: Date;
    amount: number;
  };
  error?: string;
}

// Arkama API Response Types
interface ArkamaOrderResponse {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
  value: number;
  paymentMethod: string;
  pix?: {
    payload: string; // PIX copia e cola
    qrCodeUrl?: string;
  };
  customer?: {
    name?: string;
    email?: string;
    document?: string;
  };
  items?: Array<{ name: string; value: number; quantity: number }>;
  createdAt?: string;
  paidAt?: string;
  expiresAt?: string;
}

// In-memory store for local fallback (when API is unavailable)
const localPayments = new Map<
  string,
  {
    status: 'pending' | 'processing' | 'paid' | 'failed' | 'expired';
    amount: number;
    currency: string;
    createdAt: Date;
    expiresAt: Date;
    paidAt?: Date;
    pixCopyPaste: string;
    autoConfirmTimer?: ReturnType<typeof setTimeout>;
  }
>();

// Auto-pay simulation delay for local fallback (10 seconds)
const AUTO_PAY_DELAY_MS = 10000;

// Map purchase ID to payment ID for instant confirmation
const purchaseToPaymentMap = new Map<string, string>();

export class ArkamaService {
  private static api: AxiosInstance | null = null;

  /**
   * Get or create axios instance
   */
  private static getApi(): AxiosInstance {
    if (!this.api) {
      this.api = axios.create({
        baseURL: ARKAMA_API_URL,
        headers: {
          'Authorization': `Bearer ${ARKAMA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 seconds
      });

      // Response interceptor for logging
      this.api.interceptors.response.use(
        (response: import('axios').AxiosResponse) => {
          logger.info('[Arkama] API Response', {
            status: response.status,
            url: response.config.url,
          });
          return response;
        },
        (error: import('axios').AxiosError) => {
          logger.error('[Arkama] API Error', {
            status: error.response?.status,
            url: error.config?.url,
            message: error.message,
            data: error.response?.data,
          });
          return Promise.reject(error);
        }
      );
    }
    return this.api;
  }

  /**
   * Check if API is configured
   */
  private static isApiConfigured(): boolean {
    return !!ARKAMA_API_KEY && ARKAMA_API_KEY.length > 10;
  }

  /**
   * Create a new PIX payment via Arkama API
   */
  static async createPixPayment(
    input: CreatePixPaymentInput
  ): Promise<PixPaymentResponse> {
    // If API not configured, use local fallback
    if (!this.isApiConfigured()) {
      logger.warn('[Arkama] API key not configured, using local fallback');
      return this.createLocalPayment(input);
    }

    try {
      logger.info('[Arkama] Creating PIX payment', {
        amount: input.amount,
        externalId: input.externalId,
      });

      const api = this.getApi();

      // Build order payload according to Arkama API
      const orderPayload = {
        value: input.amount * 100, // Arkama expects cents
        paymentMethod: 'pix',
        externalId: input.externalId,
        items: [
          {
            name: input.description,
            value: input.amount * 100,
            quantity: 1,
          },
        ],
        customer: input.customer ? {
          name: input.customer.name || 'Cliente Telegram',
          email: input.customer.email || `${input.externalId}@telegram.bot`,
          document: input.customer.document,
        } : {
          name: 'Cliente Telegram',
          email: `${input.externalId}@telegram.bot`,
        },
        ip: '127.0.0.1', // Bot server IP
      };

      const response = await api.post<ArkamaOrderResponse>('/orders', orderPayload);
      const order = response.data;

      if (!order.pix?.payload) {
        throw new Error('PIX payload not returned from Arkama');
      }

      // Calculate expiry (30 minutes from now if not provided)
      const expiresAt = order.expiresAt
        ? new Date(order.expiresAt)
        : new Date(Date.now() + 30 * 60 * 1000);

      return {
        success: true,
        data: {
          id: order.id,
          pixKey: order.id, // Use order ID as reference
          pixQrCode: order.pix.qrCodeUrl || this.generateQrCodeUrl(order.pix.payload),
          pixCopyPaste: order.pix.payload,
          expiresAt,
          amount: input.amount,
          currency: input.currency,
        },
      };
    } catch (error) {
      logger.error('[Arkama] Error creating payment', { error });

      // Fallback to local on API error
      if (axios.isAxiosError(error)) {
        logger.warn('[Arkama] API failed, using local fallback');
        return this.createLocalPayment(input);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check payment status via Arkama API
   */
  static async checkPaymentStatus(
    input: CheckPaymentStatusInput
  ): Promise<PaymentStatusResponse> {
    // Check local first
    const localPayment = localPayments.get(input.paymentId);
    if (localPayment) {
      return this.checkLocalPaymentStatus(input.paymentId);
    }

    // If API not configured, return not found
    if (!this.isApiConfigured()) {
      return {
        success: false,
        error: 'Payment not found',
      };
    }

    try {
      const api = this.getApi();
      const response = await api.get<ArkamaOrderResponse>(`/${input.paymentId}`);
      const order = response.data;

      // Map Arkama status to our status
      const statusMap: Record<string, 'pending' | 'processing' | 'paid' | 'failed' | 'expired'> = {
        'PENDING': 'pending',
        'PROCESSING': 'processing',
        'PAID': 'paid',
        'FAILED': 'failed',
        'EXPIRED': 'expired',
        'REFUNDED': 'failed',
      };

      return {
        success: true,
        data: {
          id: order.id,
          status: statusMap[order.status] || 'pending',
          paidAt: order.paidAt ? new Date(order.paidAt) : undefined,
          amount: order.value / 100, // Convert from cents
        },
      };
    } catch (error) {
      logger.error('[Arkama] Error checking payment status', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Manually confirm a payment (for testing/demo - only works with local payments)
   * Cancels the auto-confirm timer if active
   */
  static async confirmPayment(paymentId: string): Promise<boolean> {
    const payment = localPayments.get(paymentId);
    if (!payment) return false;

    // Cancel auto-confirm timer if exists
    if (payment.autoConfirmTimer) {
      clearTimeout(payment.autoConfirmTimer);
      payment.autoConfirmTimer = undefined;
    }

    payment.status = 'paid';
    payment.paidAt = new Date();
    localPayments.set(paymentId, payment);

    logger.info('[Arkama] Payment manually confirmed', { paymentId });
    return true;
  }

  /**
   * Register purchase ID to payment ID mapping for instant confirmation
   */
  static registerPurchaseMapping(purchaseId: string, paymentId: string): void {
    purchaseToPaymentMap.set(purchaseId, paymentId);
    logger.info('[Arkama] Purchase mapping registered', { purchaseId, paymentId });
  }

  /**
   * Confirm payment by purchase ID (instant confirmation when user clicks "Já paguei")
   * Works only for local payments
   */
  static async confirmPaymentByPurchaseId(purchaseId: string): Promise<boolean> {
    const paymentId = purchaseToPaymentMap.get(purchaseId);
    if (!paymentId) {
      logger.warn('[Arkama] No payment mapping found for purchase', { purchaseId });
      return false;
    }

    const confirmed = await this.confirmPayment(paymentId);
    if (confirmed) {
      purchaseToPaymentMap.delete(purchaseId);
    }
    return confirmed;
  }

  /**
   * Check if a payment is local (for instant confirmation logic)
   */
  static isLocalPayment(paymentId: string): boolean {
    return paymentId.startsWith('local_') || localPayments.has(paymentId);
  }

  /**
   * Get all pending payments (for admin/debug)
   */
  static getPendingPayments(): Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: Date;
  }> {
    const pending: Array<{
      id: string;
      amount: number;
      status: string;
      createdAt: Date;
    }> = [];

    localPayments.forEach((payment, id) => {
      if (payment.status === 'pending') {
        pending.push({
          id,
          amount: payment.amount,
          status: payment.status,
          createdAt: payment.createdAt,
        });
      }
    });

    return pending;
  }

  // ============ Local Fallback Methods ============

  /**
   * Create payment locally (fallback when API unavailable)
   */
  private static async createLocalPayment(
    input: CreatePixPaymentInput
  ): Promise<PixPaymentResponse> {
    const paymentId = `local_${randomBytes(12).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const pixCopyPaste = this.generateLocalPixCode(input.amount, paymentId);

    // Create payment entry
    const paymentEntry = {
      status: 'pending' as const,
      amount: input.amount,
      currency: input.currency,
      createdAt: new Date(),
      expiresAt,
      pixCopyPaste,
      autoConfirmTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    };

    // Auto-confirm after delay (for demo) - can be cancelled if user clicks "Já paguei"
    paymentEntry.autoConfirmTimer = setTimeout(() => {
      const payment = localPayments.get(paymentId);
      if (payment && payment.status === 'pending') {
        payment.status = 'paid';
        payment.paidAt = new Date();
        payment.autoConfirmTimer = undefined;
        localPayments.set(paymentId, payment);
        logger.info('[Arkama Local] Payment auto-confirmed', { paymentId });
      }
    }, AUTO_PAY_DELAY_MS);

    localPayments.set(paymentId, paymentEntry);

    // Register the externalId (transactionId) to paymentId mapping
    purchaseToPaymentMap.set(input.externalId, paymentId);

    logger.info('[Arkama Local] Created local payment', {
      paymentId,
      amount: input.amount,
      externalId: input.externalId,
    });

    return {
      success: true,
      data: {
        id: paymentId,
        pixKey: paymentId,
        pixQrCode: this.generateQrCodeUrl(pixCopyPaste),
        pixCopyPaste,
        expiresAt,
        amount: input.amount,
        currency: input.currency,
      },
    };
  }

  /**
   * Check local payment status
   */
  private static checkLocalPaymentStatus(paymentId: string): PaymentStatusResponse {
    const payment = localPayments.get(paymentId);

    if (!payment) {
      return {
        success: false,
        error: 'Payment not found',
      };
    }

    // Check if expired
    if (payment.status === 'pending' && new Date() > payment.expiresAt) {
      payment.status = 'expired';
      localPayments.set(paymentId, payment);
    }

    return {
      success: true,
      data: {
        id: paymentId,
        status: payment.status,
        paidAt: payment.paidAt,
        amount: payment.amount,
      },
    };
  }

  /**
   * Generate local PIX code (EMV format simulation)
   */
  private static generateLocalPixCode(amount: number, txId: string): string {
    // Simplified EMV format
    const amountStr = amount.toFixed(2).padStart(10, '0');
    return `00020126580014br.gov.bcb.pix0136${txId}5204000053039865406${amountStr}5802BR5913TelegramAdmin6008SaoPaulo62070503***6304`;
  }

  /**
   * Generate QR code URL using a free QR code API
   * Note: Google Charts API was deprecated in 2019
   * Using api.qrserver.com which is free and reliable
   */
  private static generateQrCodeUrl(data: string): string {
    const encodedData = encodeURIComponent(data);
    // Using goqr.me API - free, no rate limits, reliable
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedData}`;
  }
}
