import { describe, expect, it } from 'vitest';
import {
  derivePaymentBand,
  deriveRtrDisplayStatus,
  type PaymentInputCharge,
  sortTenanciesNewestFirst,
  summarisePayments,
} from '../passport-stats';

describe('derivePaymentBand', () => {
  it('returns no_record when there are no paid charges', () => {
    expect(derivePaymentBand({ paid_charges: 0, on_time_charges: 0 })).toBe('no_record');
  });

  it('returns building when too few paid charges to band', () => {
    expect(derivePaymentBand({ paid_charges: 1, on_time_charges: 1 })).toBe('building');
    expect(derivePaymentBand({ paid_charges: 2, on_time_charges: 0 })).toBe('building');
  });

  it('returns excellent when 100% of paid charges were on time', () => {
    expect(derivePaymentBand({ paid_charges: 12, on_time_charges: 12 })).toBe('excellent');
  });

  it('returns reliable for 90-99% on-time', () => {
    expect(derivePaymentBand({ paid_charges: 10, on_time_charges: 9 })).toBe('reliable');
    expect(derivePaymentBand({ paid_charges: 100, on_time_charges: 95 })).toBe('reliable');
  });

  it('returns mixed when below 90% on-time', () => {
    expect(derivePaymentBand({ paid_charges: 10, on_time_charges: 8 })).toBe('mixed');
    expect(derivePaymentBand({ paid_charges: 10, on_time_charges: 0 })).toBe('mixed');
  });
});

describe('summarisePayments', () => {
  it('returns no_record + zeros when there are no charges', () => {
    const out = summarisePayments([]);
    expect(out).toEqual({
      band: 'no_record',
      total_paid_pence: 0,
      paid_charges: 0,
      on_time_charges: 0,
      late_charges: 0,
      earliest_payment_date: null,
      latest_payment_date: null,
    });
  });

  it('counts a fully-paid charge as on time when settled by due date', () => {
    const charges: PaymentInputCharge[] = [
      {
        due_date: '2026-01-01',
        total_pence: 80000,
        payments: [{ paid_at: '2025-12-31', amount_pence: 80000, status: 'paid' }],
      },
    ];
    const out = summarisePayments(charges);
    expect(out.paid_charges).toBe(1);
    expect(out.on_time_charges).toBe(1);
    expect(out.late_charges).toBe(0);
    expect(out.total_paid_pence).toBe(80000);
    expect(out.band).toBe('building'); // 1 < min charges
  });

  it('counts a fully-paid charge as late when settled after due date', () => {
    const charges: PaymentInputCharge[] = [
      {
        due_date: '2026-01-01',
        total_pence: 80000,
        payments: [{ paid_at: '2026-01-05', amount_pence: 80000, status: 'paid' }],
      },
    ];
    const out = summarisePayments(charges);
    expect(out.late_charges).toBe(1);
    expect(out.on_time_charges).toBe(0);
  });

  it('ignores partial payments (charge does not count as paid)', () => {
    const charges: PaymentInputCharge[] = [
      {
        due_date: '2026-01-01',
        total_pence: 80000,
        payments: [{ paid_at: '2026-01-01', amount_pence: 50000, status: 'paid' }],
      },
    ];
    const out = summarisePayments(charges);
    expect(out.paid_charges).toBe(0);
    expect(out.total_paid_pence).toBe(0);
  });

  it('uses the LAST payment that crossed the total to decide on-time-ness', () => {
    // Two part payments — first on time, second late. Charge only
    // becomes "paid" with the second; that's the deciding date.
    const charges: PaymentInputCharge[] = [
      {
        due_date: '2026-01-01',
        total_pence: 80000,
        payments: [
          { paid_at: '2025-12-30', amount_pence: 50000, status: 'paid' },
          { paid_at: '2026-01-10', amount_pence: 30000, status: 'paid' },
        ],
      },
    ];
    const out = summarisePayments(charges);
    expect(out.paid_charges).toBe(1);
    expect(out.late_charges).toBe(1);
    expect(out.on_time_charges).toBe(0);
  });

  it('skips failed/pending payments', () => {
    const charges: PaymentInputCharge[] = [
      {
        due_date: '2026-01-01',
        total_pence: 80000,
        payments: [
          { paid_at: '2025-12-30', amount_pence: 80000, status: 'failed' },
          { paid_at: '2025-12-31', amount_pence: 80000, status: 'pending' },
        ],
      },
    ];
    const out = summarisePayments(charges);
    expect(out.paid_charges).toBe(0);
  });

  it('produces an excellent band when all 12 charges are on time', () => {
    const charges: PaymentInputCharge[] = Array.from({ length: 12 }, (_, i) => ({
      due_date: `2026-${String(i + 1).padStart(2, '0')}-01`,
      total_pence: 80000,
      payments: [
        {
          paid_at: `2026-${String(i + 1).padStart(2, '0')}-01`,
          amount_pence: 80000,
          status: 'paid' as const,
        },
      ],
    }));
    const out = summarisePayments(charges);
    expect(out.band).toBe('excellent');
    expect(out.total_paid_pence).toBe(12 * 80000);
  });

  it('tracks earliest + latest payment dates across charges', () => {
    const charges: PaymentInputCharge[] = [
      {
        due_date: '2026-01-01',
        total_pence: 1000,
        payments: [{ paid_at: '2026-01-15', amount_pence: 1000, status: 'paid' }],
      },
      {
        due_date: '2026-02-01',
        total_pence: 1000,
        payments: [{ paid_at: '2026-02-01', amount_pence: 1000, status: 'paid' }],
      },
      {
        due_date: '2025-12-01',
        total_pence: 1000,
        payments: [{ paid_at: '2025-12-01', amount_pence: 1000, status: 'paid' }],
      },
    ];
    const out = summarisePayments(charges);
    expect(out.earliest_payment_date).toBe('2025-12-01');
    expect(out.latest_payment_date).toBe('2026-02-01');
  });
});

describe('deriveRtrDisplayStatus', () => {
  it('returns not_recorded when item is null/undefined', () => {
    expect(deriveRtrDisplayStatus(null)).toMatchObject({ status: 'not_recorded' });
    expect(deriveRtrDisplayStatus(undefined)).toMatchObject({ status: 'not_recorded' });
  });

  it('maps ok + due_soon to verified', () => {
    expect(
      deriveRtrDisplayStatus({
        status: 'ok',
        issued_at: '2025-01-01',
        expires_at: '2027-01-01',
      }),
    ).toEqual({ status: 'verified', issued_at: '2025-01-01', expires_at: '2027-01-01' });
    expect(deriveRtrDisplayStatus({ status: 'due_soon' })).toMatchObject({ status: 'verified' });
  });

  it('maps overdue to expired', () => {
    expect(deriveRtrDisplayStatus({ status: 'overdue' })).toMatchObject({ status: 'expired' });
  });

  it('maps unknown to pending', () => {
    expect(deriveRtrDisplayStatus({ status: 'unknown' })).toMatchObject({ status: 'pending' });
  });
});

describe('sortTenanciesNewestFirst', () => {
  it('sorts by start_date descending', () => {
    const out = sortTenanciesNewestFirst([
      { id: 'b', start_date: '2025-06-01' },
      { id: 'a', start_date: '2026-01-01' },
      { id: 'c', start_date: '2024-12-01' },
    ]);
    expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns a new array (does not mutate input)', () => {
    const input = [
      { id: 'a', start_date: '2024-01-01' },
      { id: 'b', start_date: '2026-01-01' },
    ];
    const out = sortTenanciesNewestFirst(input);
    expect(out).not.toBe(input);
    expect(input.map((r) => r.id)).toEqual(['a', 'b']);
  });
});
