import { describe, expect, it } from 'vitest';
import type { RentCharge } from '@/core/schemas/rent';
import {
  chargeOutstandingPence,
  deriveChargeStatus,
  forecastRentPeriods,
  groupChargesByTime,
  humaniseDueDate,
  isFullyPaid,
  nextRentPeriod,
  totalArrearsPence,
} from '@/core/utils/rent-rules';

const charge = (overrides: Partial<RentCharge> = {}): RentCharge => ({
  id: '00000000-0000-0000-0000-000000000001',
  org_id: '00000000-0000-0000-0000-000000000010',
  tenancy_id: '00000000-0000-0000-0000-000000000020',
  period_start: '2026-04-01',
  period_end: '2026-04-30',
  due_date: '2026-04-01',
  amount_pence: 50_000,
  currency: 'GBP',
  paid_pence: 0,
  status: 'upcoming',
  notes: null,
  external_charge_id: null,
  created_by: null,
  created_at: '2026-03-25T00:00:00Z',
  updated_at: '2026-03-25T00:00:00Z',
  ...overrides,
});

describe('rent-rules/nextRentPeriod', () => {
  it('returns the first monthly period anchored to rentDueDay on or after start', () => {
    const period = nextRentPeriod({
      startDate: '2026-04-15',
      rentFrequency: 'monthly',
      rentDueDay: 1,
      lastPeriodStart: null,
    });
    expect(period).not.toBeNull();
    expect(period?.periodStart).toBe('2026-05-01');
    expect(period?.periodEnd).toBe('2026-05-31');
    expect(period?.dueDate).toBe('2026-05-01');
  });

  it('uses the start date when due day falls on or after the start within the same month', () => {
    const period = nextRentPeriod({
      startDate: '2026-04-01',
      rentFrequency: 'monthly',
      rentDueDay: 5,
      lastPeriodStart: null,
    });
    expect(period?.periodStart).toBe('2026-04-05');
  });

  it('caps rentDueDay at 28 to dodge Feb edge cases', () => {
    const period = nextRentPeriod({
      startDate: '2026-02-01',
      rentFrequency: 'monthly',
      rentDueDay: 31,
      lastPeriodStart: null,
    });
    expect(period?.periodStart).toBe('2026-02-28');
  });

  it('rolls over to the next month when last_period_start is given', () => {
    const period = nextRentPeriod({
      startDate: '2026-04-01',
      rentFrequency: 'monthly',
      rentDueDay: 1,
      lastPeriodStart: '2026-04-01',
    });
    expect(period?.periodStart).toBe('2026-05-01');
    expect(period?.periodEnd).toBe('2026-05-31');
  });

  it('returns 7-day periods for weekly tenancies', () => {
    const first = nextRentPeriod({
      startDate: '2026-04-06',
      rentFrequency: 'weekly',
      rentDueDay: 1,
      lastPeriodStart: null,
    });
    expect(first?.periodStart).toBe('2026-04-06');
    expect(first?.periodEnd).toBe('2026-04-12');
    expect(first?.dueDate).toBe('2026-04-06');

    const second = nextRentPeriod({
      startDate: '2026-04-06',
      rentFrequency: 'weekly',
      rentDueDay: 1,
      lastPeriodStart: '2026-04-06',
    });
    expect(second?.periodStart).toBe('2026-04-13');
    expect(second?.periodEnd).toBe('2026-04-19');
  });

  it('returns null when the next period would start after end_date', () => {
    const period = nextRentPeriod({
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      rentFrequency: 'monthly',
      rentDueDay: 1,
      lastPeriodStart: '2026-04-01',
    });
    expect(period).toBeNull();
  });
});

describe('rent-rules/forecastRentPeriods', () => {
  it('forecasts N consecutive periods', () => {
    const periods = forecastRentPeriods(
      {
        startDate: '2026-04-01',
        rentFrequency: 'monthly',
        rentDueDay: 1,
        lastPeriodStart: null,
      },
      3,
    );
    expect(periods).toHaveLength(3);
    expect(periods[0]?.periodStart).toBe('2026-04-01');
    expect(periods[1]?.periodStart).toBe('2026-05-01');
    expect(periods[2]?.periodStart).toBe('2026-06-01');
  });

  it('stops short when the tenancy ends', () => {
    const periods = forecastRentPeriods(
      {
        startDate: '2026-04-01',
        endDate: '2026-05-31',
        rentFrequency: 'monthly',
        rentDueDay: 1,
        lastPeriodStart: null,
      },
      6,
    );
    expect(periods).toHaveLength(2);
  });
});

describe('rent-rules/chargeOutstandingPence + isFullyPaid', () => {
  it('returns the unpaid balance, never negative', () => {
    expect(chargeOutstandingPence({ amount_pence: 50_000, paid_pence: 0 })).toBe(50_000);
    expect(chargeOutstandingPence({ amount_pence: 50_000, paid_pence: 30_000 })).toBe(20_000);
    expect(chargeOutstandingPence({ amount_pence: 50_000, paid_pence: 60_000 })).toBe(0);
  });

  it('reports fully paid when paid >= amount', () => {
    expect(isFullyPaid({ amount_pence: 50_000, paid_pence: 50_000 })).toBe(true);
    expect(isFullyPaid({ amount_pence: 50_000, paid_pence: 49_999 })).toBe(false);
  });
});

describe('rent-rules/deriveChargeStatus', () => {
  const today = new Date('2026-04-15T00:00:00Z');

  it('respects terminal states (cancelled / waived) regardless of payment', () => {
    expect(
      deriveChargeStatus(
        charge({ status: 'cancelled', paid_pence: 0, due_date: '2026-04-01' }),
        today,
      ),
    ).toBe('cancelled');
    expect(
      deriveChargeStatus(
        charge({ status: 'waived', paid_pence: 0, due_date: '2026-04-01' }),
        today,
      ),
    ).toBe('waived');
  });

  it('returns "paid" when fully paid even if due_date is in the future', () => {
    expect(
      deriveChargeStatus(
        charge({ paid_pence: 50_000, amount_pence: 50_000, due_date: '2026-05-01' }),
        today,
      ),
    ).toBe('paid');
  });

  it('returns "overdue" when unpaid and due_date is in the past', () => {
    expect(deriveChargeStatus(charge({ paid_pence: 0, due_date: '2026-04-01' }), today)).toBe(
      'overdue',
    );
  });

  it('returns "partially_paid" when some pence paid and not yet overdue', () => {
    expect(deriveChargeStatus(charge({ paid_pence: 10_000, due_date: '2026-04-15' }), today)).toBe(
      'partially_paid',
    );
  });

  it('returns "due" exactly on the due date', () => {
    expect(deriveChargeStatus(charge({ paid_pence: 0, due_date: '2026-04-15' }), today)).toBe(
      'due',
    );
  });

  it('returns "upcoming" when due_date is in the future', () => {
    expect(deriveChargeStatus(charge({ paid_pence: 0, due_date: '2026-05-01' }), today)).toBe(
      'upcoming',
    );
  });
});

describe('rent-rules/totalArrearsPence', () => {
  it('sums outstanding across charges and ignores cancelled / waived ones', () => {
    expect(
      totalArrearsPence([
        charge({ amount_pence: 50_000, paid_pence: 0, status: 'overdue' }),
        charge({ amount_pence: 50_000, paid_pence: 50_000, status: 'paid' }),
        charge({ amount_pence: 50_000, paid_pence: 20_000, status: 'partially_paid' }),
        charge({ amount_pence: 50_000, paid_pence: 0, status: 'cancelled' }),
        charge({ amount_pence: 50_000, paid_pence: 0, status: 'waived' }),
      ]),
    ).toBe(80_000);
  });

  it('returns 0 for an empty list', () => {
    expect(totalArrearsPence([])).toBe(0);
  });
});

describe('rent-rules/groupChargesByTime', () => {
  const today = new Date('2026-04-15T00:00:00Z');

  it('buckets charges by derived status', () => {
    const charges = [
      charge({ id: '00000000-0000-0000-0000-000000000aaa', due_date: '2026-04-01', paid_pence: 0 }),
      charge({ id: '00000000-0000-0000-0000-000000000bbb', due_date: '2026-04-15', paid_pence: 0 }),
      charge({ id: '00000000-0000-0000-0000-000000000ccc', due_date: '2026-05-01', paid_pence: 0 }),
      charge({
        id: '00000000-0000-0000-0000-000000000ddd',
        due_date: '2026-03-01',
        paid_pence: 50_000,
        amount_pence: 50_000,
      }),
    ];
    const grouped = groupChargesByTime(charges, today);
    expect(grouped.overdue.map((c) => c.id)).toEqual(['00000000-0000-0000-0000-000000000aaa']);
    expect(grouped.due.map((c) => c.id)).toEqual(['00000000-0000-0000-0000-000000000bbb']);
    expect(grouped.upcoming.map((c) => c.id)).toEqual(['00000000-0000-0000-0000-000000000ccc']);
    expect(grouped.paid.map((c) => c.id)).toEqual(['00000000-0000-0000-0000-000000000ddd']);
  });
});

describe('rent-rules/humaniseDueDate', () => {
  const today = new Date('2026-04-15T00:00:00Z');

  it('formats overdue days', () => {
    expect(humaniseDueDate({ due_date: '2026-04-14' }, today)).toBe('1 day overdue');
    expect(humaniseDueDate({ due_date: '2026-04-10' }, today)).toBe('5 days overdue');
  });

  it('formats current and near-future dates', () => {
    expect(humaniseDueDate({ due_date: '2026-04-15' }, today)).toBe('Due today');
    expect(humaniseDueDate({ due_date: '2026-04-16' }, today)).toBe('Due tomorrow');
    expect(humaniseDueDate({ due_date: '2026-04-22' }, today)).toBe('Due in 7 days');
  });

  it('falls back to ISO date for far-future charges', () => {
    expect(humaniseDueDate({ due_date: '2026-06-01' }, today)).toBe('Due 2026-06-01');
  });
});
