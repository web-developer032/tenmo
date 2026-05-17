/**
 * Rent rules — pure helpers used by both client UI and server route
 * handlers. No `react`, `next`, `dom`, or `window` references; safe to
 * import from the future React Native app.
 */

import { addDays, addMonths, differenceInCalendarDays, isBefore, parseISO } from 'date-fns';
import type { RentCharge, RentChargeStatus } from '../schemas/rent';
import type { RentFrequency } from '../schemas/tenancy';
import { fromIsoDate, toIsoDate } from './dates';

export type { RentFrequency };

export type RentPeriod = {
  periodStart: string;
  periodEnd: string;
  dueDate: string;
};

/**
 * Compute the next billing period for an active tenancy given the previous
 * `period_start` (or `null` if this is the first period). Mirrors the
 * `next_rent_period` SQL function so client previews stay consistent.
 *
 * Monthly tenancies anchor to `rentDueDay` (1-31, capped at 28 to dodge
 * Feb edge cases); weekly tenancies tile on 7-day periods from the start.
 */
export function nextRentPeriod(input: {
  startDate: string;
  endDate?: string | null;
  rentFrequency: RentFrequency;
  rentDueDay: number;
  lastPeriodStart?: string | null;
}): RentPeriod | null {
  const start = fromIsoDate(input.startDate);
  const end = input.endDate ? fromIsoDate(input.endDate) : null;

  let periodStart: Date;
  let periodEnd: Date;
  let dueDate: Date;

  if (input.rentFrequency === 'weekly') {
    if (input.lastPeriodStart) {
      periodStart = addDays(fromIsoDate(input.lastPeriodStart), 7);
    } else {
      periodStart = start;
    }
    periodEnd = addDays(periodStart, 6);
    dueDate = periodStart;
  } else {
    if (input.lastPeriodStart) {
      periodStart = addMonths(fromIsoDate(input.lastPeriodStart), 1);
    } else {
      const dueDay = Math.min(Math.max(input.rentDueDay || 1, 1), 28);
      const month = new Date(start.getFullYear(), start.getMonth(), dueDay);
      periodStart = isBefore(month, start) ? addMonths(month, 1) : month;
    }
    periodEnd = addDays(addMonths(periodStart, 1), -1);
    dueDate = periodStart;
  }

  if (end && isBefore(end, periodStart)) {
    return null;
  }

  return {
    periodStart: toIsoDate(periodStart),
    periodEnd: toIsoDate(periodEnd),
    dueDate: toIsoDate(dueDate),
  };
}

/**
 * Forecast the next N billing periods. Useful for the "upcoming charges"
 * preview on the tenancy page when the cron hasn't created them yet.
 */
export function forecastRentPeriods(
  input: {
    startDate: string;
    endDate?: string | null;
    rentFrequency: RentFrequency;
    rentDueDay: number;
    lastPeriodStart?: string | null;
  },
  count: number,
): RentPeriod[] {
  const out: RentPeriod[] = [];
  let cursor = input.lastPeriodStart ?? null;
  for (let i = 0; i < count; i++) {
    const next = nextRentPeriod({ ...input, lastPeriodStart: cursor });
    if (!next) break;
    out.push(next);
    cursor = next.periodStart;
  }
  return out;
}

/** Outstanding pence on a single charge — never negative. */
export function chargeOutstandingPence(
  charge: Pick<RentCharge, 'amount_pence' | 'paid_pence'>,
): number {
  return Math.max(charge.amount_pence - charge.paid_pence, 0);
}

/** Was this charge paid in full? */
export function isFullyPaid(charge: Pick<RentCharge, 'amount_pence' | 'paid_pence'>): boolean {
  return charge.paid_pence >= charge.amount_pence;
}

/**
 * Derive the *display* status given today's date and the charge's payment
 * progress. The DB also persists a status, but this lets the UI re-evaluate
 * client-side without a round-trip.
 */
export function deriveChargeStatus(
  charge: Pick<RentCharge, 'amount_pence' | 'paid_pence' | 'due_date' | 'status'>,
  today: Date = new Date(),
): RentChargeStatus {
  if (charge.status === 'cancelled' || charge.status === 'waived') return charge.status;
  if (isFullyPaid(charge)) return 'paid';

  const due = parseISO(charge.due_date);
  const daysUntilDue = differenceInCalendarDays(due, today);

  if (daysUntilDue < 0) return 'overdue';
  if (charge.paid_pence > 0) return 'partially_paid';
  if (daysUntilDue === 0) return 'due';
  return 'upcoming';
}

/** Total arrears for a list of charges (positive = owed by tenant). */
export function totalArrearsPence(
  charges: Array<Pick<RentCharge, 'amount_pence' | 'paid_pence' | 'status'>>,
): number {
  return charges.reduce((sum, c) => {
    if (c.status === 'cancelled' || c.status === 'waived') return sum;
    return sum + chargeOutstandingPence(c);
  }, 0);
}

/** Group charges into upcoming/current/past for the tenancy ledger view. */
export function groupChargesByTime(
  charges: RentCharge[],
  today: Date = new Date(),
): { upcoming: RentCharge[]; due: RentCharge[]; overdue: RentCharge[]; paid: RentCharge[] } {
  const upcoming: RentCharge[] = [];
  const due: RentCharge[] = [];
  const overdue: RentCharge[] = [];
  const paid: RentCharge[] = [];

  for (const charge of charges) {
    const derived = deriveChargeStatus(charge, today);
    if (derived === 'paid') paid.push(charge);
    else if (derived === 'overdue') overdue.push(charge);
    else if (derived === 'due' || derived === 'partially_paid') due.push(charge);
    else upcoming.push(charge);
  }

  return { upcoming, due, overdue, paid };
}

/** "5 days overdue" / "Due tomorrow" / "Due in 12 days". */
export function humaniseDueDate(
  charge: Pick<RentCharge, 'due_date'>,
  today: Date = new Date(),
): string {
  const days = differenceInCalendarDays(parseISO(charge.due_date), today);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 30) return `Due in ${days} days`;
  return `Due ${charge.due_date}`;
}
