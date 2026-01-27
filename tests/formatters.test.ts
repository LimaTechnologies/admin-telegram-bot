import { describe, it, expect } from 'vitest';

// Test formatting utilities used in dashboard pages
describe('Currency Formatter', () => {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  it('should format positive numbers', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });

  it('should format negative numbers', () => {
    expect(formatCurrency(-500)).toBe('-$500.00');
  });

  it('should round to 2 decimal places', () => {
    expect(formatCurrency(10.999)).toBe('$11.00');
    expect(formatCurrency(10.001)).toBe('$10.00');
  });
});

describe('Number Formatter', () => {
  const formatNumber = (num: number) =>
    new Intl.NumberFormat('en-US', { notation: 'compact' }).format(num);

  it('should format small numbers without compact notation', () => {
    expect(formatNumber(123)).toBe('123');
    expect(formatNumber(999)).toBe('999');
  });

  it('should use K for thousands', () => {
    expect(formatNumber(1000)).toBe('1K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(10000)).toBe('10K');
  });

  it('should use M for millions', () => {
    expect(formatNumber(1000000)).toBe('1M');
    expect(formatNumber(2500000)).toBe('2.5M');
  });
});

describe('Date Formatter', () => {
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  it('should format date strings', () => {
    const result = formatDate('2025-01-15T14:30:00Z');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });

  it('should format Date objects', () => {
    // Use a specific time to avoid timezone issues
    const result = formatDate(new Date('2025-06-20T12:00:00'));
    expect(result).toContain('Jun');
    expect(result).toContain('20');
  });
});

describe('Percentage Formatter', () => {
  const formatPercentage = (value: number, decimals: number = 1) =>
    `${value.toFixed(decimals)}%`;

  it('should format with default 1 decimal', () => {
    expect(formatPercentage(5.678)).toBe('5.7%');
    expect(formatPercentage(0)).toBe('0.0%');
    expect(formatPercentage(100)).toBe('100.0%');
  });

  it('should format with custom decimals', () => {
    expect(formatPercentage(3.14159, 2)).toBe('3.14%');
    expect(formatPercentage(50, 0)).toBe('50%');
  });
});
