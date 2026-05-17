import {
  GC_FAILURE_REASON_LABEL,
  GC_FAILURE_TENANT_HINT,
  type GcPaymentFailureReason,
  type GoCardlessMandateStatus,
  MANDATE_NEEDS_SETUP,
} from '../constants/payments';
import type { GoCardlessMandate } from '../schemas/payments';
import type { RentChargeStatus } from '../schemas/rent';

/**
 * Pure helpers for the payments / mandate domain. No React, no
 * Supabase, no GoCardless — testable and portable to Expo.
 */

/** True when the tenant should see a "Set up Direct Debit" CTA. */
export function needsMandateSetup(
  mandate: Pick<GoCardlessMandate, 'status'> | null | undefined,
): boolean {
  if (!mandate) return true;
  return MANDATE_NEEDS_SETUP[mandate.status];
}

/** True when the mandate can collect — only `active` is allowed. */
export function canCollect(
  mandate: Pick<GoCardlessMandate, 'status' | 'gc_mandate_id'> | null | undefined,
): boolean {
  if (!mandate) return false;
  return mandate.status === 'active' && Boolean(mandate.gc_mandate_id);
}

/** True if a charge is collectable today (open status + outstanding > 0). */
export function isChargeCollectable(charge: {
  status: RentChargeStatus;
  amount_pence: number;
  paid_pence: number;
}): boolean {
  if (charge.amount_pence <= charge.paid_pence) return false;
  return ['due', 'overdue', 'partially_paid', 'upcoming'].includes(charge.status);
}

/** Outstanding pence on a charge. Never negative. */
export function outstandingPence(charge: { amount_pence: number; paid_pence: number }): number {
  return Math.max(charge.amount_pence - charge.paid_pence, 0);
}

/** Map a raw GoCardless cause-string to the closed enum we display
 * from. Unknown strings collapse to 'unknown'. */
export function mapGcFailureCause(cause: string | null | undefined): GcPaymentFailureReason {
  if (!cause) return 'unknown';
  const k = cause.toLowerCase();
  if (k in GC_FAILURE_REASON_LABEL) {
    return k as GcPaymentFailureReason;
  }
  return 'unknown';
}

export function paymentFailureCopy(cause: string | null | undefined): {
  reason: GcPaymentFailureReason;
  label: string;
  hint: string;
} {
  const reason = mapGcFailureCause(cause);
  return {
    reason,
    label: GC_FAILURE_REASON_LABEL[reason],
    hint: GC_FAILURE_TENANT_HINT[reason],
  };
}

/**
 * GoCardless fee preview for a given collection amount in pence.
 *
 * Real fees vary by plan; this is a *preview* shown in the landlord UI
 * (it costs you ~£X to collect this rent) and is intentionally
 * conservative — bigger than reality so we never under-quote. Real
 * fees are reconciled when the GC payout webhook lands (post-MVP).
 *
 * Pricing assumption (2026-01): 1% + 20p per collection, capped at £4.
 * Tenant always pays exactly the rent — fees are absorbed by the
 * landlord's subscription.
 */
export function previewGcFeePence(amountPence: number): number {
  if (amountPence <= 0) return 0;
  const onePercent = Math.ceil(amountPence * 0.01);
  const flat = 20;
  const fee = onePercent + flat;
  return Math.min(fee, 400);
}

/** True for a status the landlord may surface a "retry collection"
 * button on. */
export function isRetryableMandateStatus(status: GoCardlessMandateStatus): boolean {
  return status === 'active';
}
