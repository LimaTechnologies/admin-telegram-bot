/**
 * Arkama Mock Service
 * Simulates PIX payment processing for development/demo purposes
 */

import { logger } from './logger';
import { randomBytes } from 'crypto';

export interface CreatePixPaymentInput {
  amount: number;
  currency: 'BRL' | 'USD';
  description: string;
  externalId: string; // Our transaction ID
}

export interface PixPaymentResponse {
  success: boolean;
  data?: {
    id: string; // Arkama transaction ID
    pixKey: string;
    pixQrCode: string; // Base64 encoded QR code
    pixCopyPaste: string; // PIX copia e cola
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

// In-memory store for mock payments (in production, this would be the Arkama API)
const mockPayments = new Map<
  string,
  {
    status: 'pending' | 'processing' | 'paid' | 'failed' | 'expired';
    amount: number;
    currency: string;
    createdAt: Date;
    expiresAt: Date;
    paidAt?: Date;
  }
>();

// Auto-pay simulation - payments auto-confirm after 10 seconds
const AUTO_PAY_DELAY_MS = 10000;

/**
 * Generate a random PIX key (simulated)
 */
function generatePixKey(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Generate a mock QR code (in production, this would be a real QR code image)
 * For demo, we return a placeholder base64 string
 */
function generateMockQrCode(pixCopyPaste: string): string {
  // In production, use a QR code library to generate actual QR code
  // For mock, we return a simple placeholder
  const placeholder = Buffer.from(
    JSON.stringify({ type: 'pix_qr', data: pixCopyPaste })
  ).toString('base64');
  return `data:image/png;base64,${placeholder}`;
}

/**
 * Generate PIX copy-paste code (EMV format simulation)
 */
function generatePixCopyPaste(amount: number, txId: string): string {
  // Simplified EMV format simulation
  // Real PIX codes follow the EMV QR Code specification
  return `00020126580014br.gov.bcb.pix0136${txId}5204000053039865406${amount.toFixed(2)}5802BR5913TelegramAdmin6008SaoPaulo62070503***6304`;
}

export class ArkamaService {
  /**
   * Create a new PIX payment
   */
  static async createPixPayment(
    input: CreatePixPaymentInput
  ): Promise<PixPaymentResponse> {
    try {
      logger.info('[Arkama Mock] Creating PIX payment', {
        amount: input.amount,
        externalId: input.externalId,
      });

      const paymentId = `ark_${randomBytes(12).toString('hex')}`;
      const pixKey = generatePixKey();
      const pixCopyPaste = generatePixCopyPaste(input.amount, paymentId);
      const pixQrCode = generateMockQrCode(pixCopyPaste);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      // Store in mock DB
      mockPayments.set(paymentId, {
        status: 'pending',
        amount: input.amount,
        currency: input.currency,
        createdAt: new Date(),
        expiresAt,
      });

      // Simulate auto-payment after delay (for demo purposes)
      setTimeout(() => {
        const payment = mockPayments.get(paymentId);
        if (payment && payment.status === 'pending') {
          payment.status = 'paid';
          payment.paidAt = new Date();
          mockPayments.set(paymentId, payment);
          logger.info('[Arkama Mock] Payment auto-confirmed', { paymentId });
        }
      }, AUTO_PAY_DELAY_MS);

      return {
        success: true,
        data: {
          id: paymentId,
          pixKey,
          pixQrCode,
          pixCopyPaste,
          expiresAt,
          amount: input.amount,
          currency: input.currency,
        },
      };
    } catch (error) {
      logger.error('[Arkama Mock] Error creating payment', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check payment status
   */
  static async checkPaymentStatus(
    input: CheckPaymentStatusInput
  ): Promise<PaymentStatusResponse> {
    try {
      const payment = mockPayments.get(input.paymentId);

      if (!payment) {
        return {
          success: false,
          error: 'Payment not found',
        };
      }

      // Check if expired
      if (payment.status === 'pending' && new Date() > payment.expiresAt) {
        payment.status = 'expired';
        mockPayments.set(input.paymentId, payment);
      }

      return {
        success: true,
        data: {
          id: input.paymentId,
          status: payment.status,
          paidAt: payment.paidAt,
          amount: payment.amount,
        },
      };
    } catch (error) {
      logger.error('[Arkama Mock] Error checking payment status', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Manually confirm a payment (for testing/demo)
   */
  static async confirmPayment(paymentId: string): Promise<boolean> {
    const payment = mockPayments.get(paymentId);
    if (!payment) return false;

    payment.status = 'paid';
    payment.paidAt = new Date();
    mockPayments.set(paymentId, payment);

    logger.info('[Arkama Mock] Payment manually confirmed', { paymentId });
    return true;
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

    mockPayments.forEach((payment, id) => {
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
}
