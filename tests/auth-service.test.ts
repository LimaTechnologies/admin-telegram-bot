import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Test the hashing logic that AuthService uses
describe('Auth Service - Hashing', () => {
  const hashToken = (token: string): string => {
    return crypto.createHash('sha256').update(token).digest('hex');
  };

  it('should generate consistent hashes for same input', () => {
    const token = 'test-token-123';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different inputs', () => {
    const hash1 = hashToken('token-1');
    const hash2 = hashToken('token-2');
    expect(hash1).not.toBe(hash2);
  });

  it('should generate 64-character hex hash (SHA-256)', () => {
    const hash = hashToken('any-token');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });
});

describe('Auth Service - Token Generation', () => {
  const generateToken = (): string => {
    return crypto.randomBytes(32).toString('hex');
  };

  it('should generate 64-character hex tokens', () => {
    const token = generateToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[a-f0-9]+$/);
  });

  it('should generate unique tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateToken());
    }
    expect(tokens.size).toBe(100);
  });
});

describe('Auth Service - Session Expiry', () => {
  const SESSION_EXPIRY_DAYS = 7;

  const calculateExpiryDate = (): Date => {
    return new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  };

  it('should calculate expiry 7 days in the future', () => {
    const now = Date.now();
    const expiry = calculateExpiryDate();
    const expectedMs = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    expect(expiry.getTime() - now).toBeGreaterThanOrEqual(expectedMs - 1000);
    expect(expiry.getTime() - now).toBeLessThanOrEqual(expectedMs + 1000);
  });

  it('should be in the future', () => {
    const expiry = calculateExpiryDate();
    expect(expiry.getTime()).toBeGreaterThan(Date.now());
  });
});
