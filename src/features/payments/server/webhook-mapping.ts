import type { GoCardlessMandateStatus } from '@/core/constants/payments';
import type { RentPaymentStatus } from '@/core/schemas/rent';
import type { GcMandateStatus, GcPaymentStatus } from '@/lib/gocardless/types';

/**
 * Pure mapping helpers for GoCardless webhook events. Extracted from
 * `apply-{mandate,payment}-webhook.ts` so they can be unit-tested
 * without spinning up a Supabase / GC mock.
 *
 * Mirrors the action-keyed transitions documented in
 * `docs/05-backend/webhooks-and-integrations.md`.
 */

/** Map a GC `mandate.action` string to our `gocardless_mandates.status`
 * column. Unknown actions return null (the caller logs + ignores). */
export function mapMandateActionToStatus(action: string): GoCardlessMandateStatus | null {
  switch (action) {
    case 'created':
      return 'pending_submission';
    case 'submitted':
      return 'submitted';
    case 'active':
      return 'active';
    case 'cancelled':
    case 'customer_approval_denied':
      return 'cancelled';
    case 'failed':
      return 'failed';
    case 'expired':
      return 'expired';
    case 'reinstated':
      return 'active';
    default:
      return null;
  }
}

/** Map a GC `mandate.status` (from a fetched mandate, not webhook) to
 * our column. Used when we re-read the mandate to reconcile drift. */
export function mapGcMandateStatus(s: GcMandateStatus): GoCardlessMandateStatus {
  switch (s) {
    case 'pending_customer_approval':
    case 'pending_submission':
      return 'pending_submission';
    case 'submitted':
      return 'submitted';
    case 'active':
      return 'active';
    case 'failed':
      return 'failed';
    case 'cancelled':
    case 'consumed':
    case 'blocked':
      return 'cancelled';
    case 'expired':
      return 'expired';
    default:
      return 'failed';
  }
}

/** Map a GC `payment.action` string to our `rent_payments.status`. */
export function mapPaymentActionToStatus(action: string): RentPaymentStatus | null {
  switch (action) {
    case 'created':
    case 'submitted':
      return 'pending';
    case 'confirmed':
    case 'paid_out':
      return 'confirmed';
    case 'failed':
    case 'cancelled':
    case 'customer_approval_denied':
      return 'failed';
    case 'charged_back':
    case 'late_failure_settled':
      return 'charged_back';
    case 'refunded':
      return 'refunded';
    default:
      return null;
  }
}

/** Map a GC `payment.status` value to our `rent_payments.status`. */
export function mapGcPaymentStatus(s: GcPaymentStatus): RentPaymentStatus {
  switch (s) {
    case 'pending_customer_approval':
    case 'pending_submission':
    case 'submitted':
      return 'pending';
    case 'confirmed':
    case 'paid_out':
      return 'confirmed';
    case 'failed':
    case 'cancelled':
    case 'customer_approval_denied':
      return 'failed';
    case 'charged_back':
      return 'charged_back';
    default:
      return 'failed';
  }
}
