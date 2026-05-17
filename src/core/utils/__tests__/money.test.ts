import { describe, expect, it } from 'vitest';
import { addMoney, formatMoney, mulMoney, pence, pounds, subMoney } from '@/core/utils/money';

describe('money/pence', () => {
  it('accepts integer pence', () => {
    expect(pence(0)).toEqual({ amountPence: 0, currency: 'GBP' });
    expect(pence(12345).amountPence).toBe(12345);
  });

  it('rejects floats', () => {
    expect(() => pence(1.5)).toThrow(TypeError);
  });

  it('rejects negatives', () => {
    expect(() => pence(-1)).toThrow(RangeError);
  });
});

describe('money/pounds', () => {
  it('rounds half-up to integer pence', () => {
    expect(pounds(10.005).amountPence).toBe(1001);
  });

  it('handles £0', () => {
    expect(pounds(0).amountPence).toBe(0);
  });
});

describe('money/formatMoney', () => {
  it('formats GBP with two decimals', () => {
    expect(formatMoney(pence(12345))).toBe('£123.45');
  });

  it('accepts a raw pence number', () => {
    expect(formatMoney(99)).toBe('£0.99');
  });
});

describe('money/arithmetic', () => {
  it('adds same-currency amounts', () => {
    expect(addMoney(pence(100), pence(50))).toEqual(pence(150));
  });

  it('subtracts but never goes below zero', () => {
    expect(subMoney(pence(100), pence(150))).toEqual(pence(0));
  });

  it('multiplies and rounds', () => {
    expect(mulMoney(pence(333), 0.5)).toEqual(pence(167));
  });
});
