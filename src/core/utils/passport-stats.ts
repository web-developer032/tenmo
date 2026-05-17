import {
  PAYMENT_BAND_EXCELLENT_THRESHOLD,
  PAYMENT_BAND_MIN_CHARGES,
  PAYMENT_BAND_RELIABLE_THRESHOLD,
  type PaymentBand,
  type RtrDisplayStatus,
} from '../constants/passport';

/**
 * Pure derivations for the Rental Passport.
 *
 * These functions take *raw* shapes (rent_payments rows, charge
 * rows, compliance_items rows) and return the small, opinionated
 * shapes the passport renderer uses. They never touch Supabase or
 * React, so they're trivially unit-testable and portable.
 */

// ---------------------------------------------------------------------------
// Payment band derivation
// ---------------------------------------------------------------------------

export interface PaymentInputCharge {
  due_date: string;
  /** All payments allocated to this charge, in chronological order. */
  payments: Array<{
    paid_at: string;
    amount_pence: number;
    status: 'pending' | 'paid' | 'failed';
  }>;
  /** Charge total in pence. */
  total_pence: number;
}

export interface PaymentSummary {
  band: PaymentBand;
  total_paid_pence: number;
  paid_charges: number;
  on_time_charges: number;
  late_charges: number;
  earliest_payment_date: string | null;
  latest_payment_date: string | null;
}

export function summarisePayments(charges: ReadonlyArray<PaymentInputCharge>): PaymentSummary {
  let totalPaid = 0;
  let paidCount = 0;
  let onTimeCount = 0;
  let lateCount = 0;
  let earliest: string | null = null;
  let latest: string | null = null;

  for (const c of charges) {
    const paidPayments = c.payments.filter((p) => p.status === 'paid');
    const totalPaidForCharge = paidPayments.reduce((acc, p) => acc + p.amount_pence, 0);
    if (totalPaidForCharge < c.total_pence) continue; // partial pays don't count as "paid charge"

    paidCount += 1;
    totalPaid += totalPaidForCharge;

    // The "settled at" date is the date of the latest payment that
    // brought the cumulative total to (or above) the charge total.
    let cumulative = 0;
    let settledAt: string | null = null;
    for (const p of paidPayments) {
      cumulative += p.amount_pence;
      if (cumulative >= c.total_pence) {
        settledAt = p.paid_at;
        break;
      }
    }
    if (settledAt) {
      if (settledAt <= c.due_date) {
        onTimeCount += 1;
      } else {
        lateCount += 1;
      }
    }

    for (const p of paidPayments) {
      if (!earliest || p.paid_at < earliest) earliest = p.paid_at;
      if (!latest || p.paid_at > latest) latest = p.paid_at;
    }
  }

  return {
    band: derivePaymentBand({ paid_charges: paidCount, on_time_charges: onTimeCount }),
    total_paid_pence: totalPaid,
    paid_charges: paidCount,
    on_time_charges: onTimeCount,
    late_charges: lateCount,
    earliest_payment_date: earliest,
    latest_payment_date: latest,
  };
}

export function derivePaymentBand(args: {
  paid_charges: number;
  on_time_charges: number;
}): PaymentBand {
  if (args.paid_charges === 0) return 'no_record';
  if (args.paid_charges < PAYMENT_BAND_MIN_CHARGES) return 'building';
  const ratio = args.on_time_charges / args.paid_charges;
  if (ratio >= PAYMENT_BAND_EXCELLENT_THRESHOLD) return 'excellent';
  if (ratio >= PAYMENT_BAND_RELIABLE_THRESHOLD) return 'reliable';
  return 'mixed';
}

// ---------------------------------------------------------------------------
// Right to Rent display status
// ---------------------------------------------------------------------------

/**
 * RTR input is a `compliance_items` row of `type='right_to_rent'`.
 * Status vocabulary mirrors the database CHECK on
 * `compliance_items.status`: `ok | due_soon | overdue | unknown`.
 */
export interface RtrInputItem {
  status: 'ok' | 'due_soon' | 'overdue' | 'unknown';
  issued_at?: string | null;
  expires_at?: string | null;
}

export function deriveRtrDisplayStatus(item: RtrInputItem | null | undefined): {
  status: RtrDisplayStatus;
  issued_at: string | null;
  expires_at: string | null;
} {
  if (!item) {
    return { status: 'not_recorded', issued_at: null, expires_at: null };
  }
  switch (item.status) {
    case 'ok':
    case 'due_soon':
      return {
        status: 'verified',
        issued_at: item.issued_at ?? null,
        expires_at: item.expires_at ?? null,
      };
    case 'overdue':
      return {
        status: 'expired',
        issued_at: item.issued_at ?? null,
        expires_at: item.expires_at ?? null,
      };
    case 'unknown':
      return {
        status: 'pending',
        issued_at: item.issued_at ?? null,
        expires_at: item.expires_at ?? null,
      };
    default: {
      const exhaustive: never = item.status;
      throw new Error(`Unknown RTR status: ${String(exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Tenancy summarising
// ---------------------------------------------------------------------------

/**
 * Sort tenancy entries newest-first (by start_date desc) so the PDF
 * leads with the current/most-recent tenancy.
 */
export function sortTenanciesNewestFirst<T extends { start_date: string }>(
  rows: ReadonlyArray<T>,
): T[] {
  return [...rows].sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
}
