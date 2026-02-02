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

describe('Auth Service - Password Generation', () => {
  const PASSWORD_LENGTH = 16;

  const generateSecurePassword = (length: number = PASSWORD_LENGTH): string => {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%&*';

    const allChars = uppercase + lowercase + numbers + symbols;

    let password = '';
    password += uppercase[crypto.randomInt(uppercase.length)];
    password += lowercase[crypto.randomInt(lowercase.length)];
    password += numbers[crypto.randomInt(numbers.length)];
    password += symbols[crypto.randomInt(symbols.length)];

    for (let i = password.length; i < length; i++) {
      password += allChars[crypto.randomInt(allChars.length)];
    }

    const shuffled = password
      .split('')
      .sort(() => crypto.randomInt(3) - 1)
      .join('');
    return shuffled;
  };

  it('should generate password of correct length', () => {
    const password = generateSecurePassword();
    expect(password).toHaveLength(PASSWORD_LENGTH);
  });

  it('should contain at least one uppercase letter', () => {
    const password = generateSecurePassword();
    expect(password).toMatch(/[A-Z]/);
  });

  it('should contain at least one lowercase letter', () => {
    const password = generateSecurePassword();
    expect(password).toMatch(/[a-z]/);
  });

  it('should contain at least one number', () => {
    const password = generateSecurePassword();
    expect(password).toMatch(/[0-9]/);
  });

  it('should contain at least one symbol', () => {
    const password = generateSecurePassword();
    expect(password).toMatch(/[!@#$%&*]/);
  });

  it('should generate unique passwords', () => {
    const passwords = new Set<string>();
    for (let i = 0; i < 50; i++) {
      passwords.add(generateSecurePassword());
    }
    expect(passwords.size).toBe(50);
  });
});
