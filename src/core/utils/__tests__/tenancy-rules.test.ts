import { describe, expect, it } from 'vitest';
import {
  annualRentPenceFrom,
  canIncreaseRent,
  isEndDateValid,
  maxDepositPence,
  noticeDaysForEndReason,
  rejectSection21,
  weeklyRentPenceFrom,
} from '@/core/utils/tenancy-rules';

describe('tenancy-rules/canIncreaseRent', () => {
  const NOW = new Date('2026-04-26');

  it('allows the first ever increase', () => {
    expect(canIncreaseRent(null, NOW)).toBe(true);
  });

  it('blocks within 12 months', () => {
    expect(canIncreaseRent('2025-06-01', NOW)).toBe(false);
  });

  it('allows after 12 months', () => {
    expect(canIncreaseRent('2025-04-01', NOW)).toBe(true);
  });
});

describe('tenancy-rules/maxDepositPence', () => {
  it('caps at 5 weeks for sub-£50k annual rent', () => {
    const weekly = 30_000;
    const annual = weekly * 52;
    expect(maxDepositPence(annual, weekly)).toBe(weekly * 5);
  });

  it('caps at 6 weeks for £50k+ annual rent', () => {
    const weekly = 100_000;
    const annual = weekly * 52;
    expect(maxDepositPence(annual, weekly)).toBe(weekly * 6);
  });
});

describe('tenancy-rules/conversions', () => {
  it('weekly stays weekly', () => {
    expect(weeklyRentPenceFrom(20_000, 'weekly')).toBe(20_000);
  });
  it('monthly converts to weekly correctly', () => {
    expect(weeklyRentPenceFrom(86_667, 'monthly')).toBe(20_000);
  });
  it('annual rent multiplies properly', () => {
    expect(annualRentPenceFrom(80_000, 'monthly')).toBe(960_000);
    expect(annualRentPenceFrom(20_000, 'weekly')).toBe(1_040_000);
  });
});

describe('tenancy-rules/rejectSection21', () => {
  it('always throws', () => {
    expect(() => rejectSection21()).toThrow(/Section 21/);
  });
});

describe('tenancy-rules/end-notice', () => {
  const TODAY = new Date('2026-04-26T00:00:00Z');

  it('tenant_notice has no minimum (tenant chooses date)', () => {
    expect(noticeDaysForEndReason('tenant_notice')).toBe(0);
    expect(isEndDateValid('2026-04-26', 'tenant_notice', TODAY)).toBe(true);
  });

  it('mutual_break needs no notice', () => {
    expect(isEndDateValid('2026-04-26', 'mutual_break', TODAY)).toBe(true);
  });

  it('rent_arrears requires at least 14 days', () => {
    expect(isEndDateValid('2026-05-01', 'rent_arrears', TODAY)).toBe(false);
    expect(isEndDateValid('2026-05-10', 'rent_arrears', TODAY)).toBe(true);
  });

  it('landlord_moving_in requires 4 months (~120 days)', () => {
    expect(isEndDateValid('2026-07-01', 'landlord_moving_in', TODAY)).toBe(false);
    expect(isEndDateValid('2026-09-01', 'landlord_moving_in', TODAY)).toBe(true);
  });

  it('sale_of_property requires 4 months', () => {
    expect(noticeDaysForEndReason('sale_of_property')).toBe(120);
  });

  it('unknown reason gets the default 60-day floor via fallback', () => {
    expect(noticeDaysForEndReason('other')).toBe(60);
    expect(isEndDateValid('2026-05-01', 'other', TODAY)).toBe(false);
    expect(isEndDateValid('2026-07-01', 'other', TODAY)).toBe(true);
  });
});
