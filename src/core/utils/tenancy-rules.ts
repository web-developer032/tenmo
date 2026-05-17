/**
 * Renters' Rights Bill rules — domain logic encoded once, used everywhere.
 *
 * Sources of truth: docs/08-uk-compliance/renters-rights-bill.md.
 */

import { addMonths, differenceInCalendarDays, differenceInMonths } from 'date-fns';
import { fromIsoDate } from './dates';

/**
 * Check if rent can be increased on a tenancy.
 *
 * Rule: max 1 rent increase per 12-month period; minimum 12 months between increases.
 */
export function canIncreaseRent(lastIncreaseAt: string | null, now: Date = new Date()): boolean {
  if (!lastIncreaseAt) return true;
  const last = fromIsoDate(lastIncreaseAt);
  return differenceInMonths(now, last) >= 12;
}

/** When is the next allowed rent increase, given the last one? */
export function nextAllowedRentIncrease(lastIncreaseAt: string): Date {
  return addMonths(fromIsoDate(lastIncreaseAt), 12);
}

/**
 * Maximum allowed deposit per RRB / Tenant Fees Act:
 *   - Annual rent < £50,000 → 5 weeks' rent.
 *   - Annual rent ≥ £50,000 → 6 weeks' rent.
 */
export function maxDepositPence(annualRentPence: number, weeklyRentPence: number): number {
  const weeks = annualRentPence < 5_000_000 ? 5 : 6;
  return Math.round(weeklyRentPence * weeks);
}

/**
 * Rent frequency multipliers used for converting to weekly equivalent.
 */
export function weeklyRentPenceFrom(rentPence: number, frequency: 'monthly' | 'weekly'): number {
  if (frequency === 'weekly') return rentPence;
  return Math.round((rentPence * 12) / 52);
}

/**
 * Annual rent — used for deposit cap calculations.
 */
export function annualRentPenceFrom(rentPence: number, frequency: 'monthly' | 'weekly'): number {
  if (frequency === 'weekly') return rentPence * 52;
  return rentPence * 12;
}

/**
 * Monthly equivalent — used for cross-tenancy comparisons and the
 * Rental Passport "rent pcm" line. Weekly tenancies are converted using
 * the standard 52/12 ratio; monthly tenancies are returned as-is.
 */
export function monthlyRentPenceFrom(rentPence: number, frequency: 'monthly' | 'weekly'): number {
  if (frequency === 'monthly') return rentPence;
  return Math.round((rentPence * 52) / 12);
}

/**
 * Section 21 is abolished by the Renters' Rights Bill. This guard is used by
 * server validation to refuse any code path attempting to issue a Section 21.
 */
export function rejectSection21(): never {
  throw new Error("Section 21 notices are abolished under the Renters' Rights Bill.");
}

/**
 * Minimum notice (in days) a landlord must give to end a tenancy under the
 * Renters' Rights Bill, by reason code.
 *
 * NOTE: These are simplified MVP figures — the eventual implementation will
 * read live from `docs/08-uk-compliance/renters-rights-bill.md` once the bill
 * receives Royal Assent and the schedules are finalised. They're encoded here
 * so server validation has *some* floor to enforce.
 */
const NOTICE_DAYS_BY_REASON: Record<string, number> = {
  tenant_notice: 0, // tenant ending — they set their own date
  mutual_break: 0, // both parties agree
  rent_arrears: 14, // mandatory ground (8 weeks' arrears, 14-day notice)
  antisocial_behaviour: 14,
  breach_of_terms: 28,
  landlord_moving_in: 120, // 4 months
  sale_of_property: 120,
  other: 60,
};

export type TenancyEndReasonLike = keyof typeof NOTICE_DAYS_BY_REASON;

/**
 * Returns the minimum legal notice in days for a given end-tenancy reason
 * under the Renters' Rights Bill.
 */
export function noticeDaysForEndReason(reason: TenancyEndReasonLike): number {
  return NOTICE_DAYS_BY_REASON[reason] ?? 60;
}

/**
 * Validate that a proposed `end_date` honours the minimum notice for the
 * given reason. `today` is injected for testability.
 */
export function isEndDateValid(
  endDateIso: string,
  reason: TenancyEndReasonLike,
  today: Date = new Date(),
): boolean {
  const minDays = noticeDaysForEndReason(reason);
  if (minDays === 0) return true;
  const diffDays = differenceInCalendarDays(fromIsoDate(endDateIso), today);
  return diffDays >= minDays;
}
