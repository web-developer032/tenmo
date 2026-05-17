/**
 * Payments domain — GoCardless DD mandate states + failure-reason copy.
 *
 * The rent ledger already owns `RentPaymentMethod` / `RentPaymentStatus`
 * in `core/schemas/rent.ts`; this file is specifically for the
 * Direct-Debit *mandate* side (the relationship between a tenant's
 * bank account and a tenancy) plus shared user-facing copy.
 *
 * No GoCardless SDK imports here — this file is portable to the
 * future Expo app.
 */

export type GoCardlessMandateStatus =
  | 'pending_submission'
  | 'submitted'
  | 'active'
  | 'cancelled'
  | 'failed'
  | 'expired';

export const GOCARDLESS_MANDATE_STATUS_VALUES: GoCardlessMandateStatus[] = [
  'pending_submission',
  'submitted',
  'active',
  'cancelled',
  'failed',
  'expired',
];

/** UI label per status. */
export const MANDATE_STATUS_LABEL: Record<GoCardlessMandateStatus, string> = {
  pending_submission: 'Setting up',
  submitted: 'Awaiting bank',
  active: 'Active',
  cancelled: 'Cancelled',
  failed: 'Failed',
  expired: 'Expired',
};

/** Tone for the badge component. */
export const MANDATE_STATUS_TONE: Record<
  GoCardlessMandateStatus,
  'default' | 'success' | 'warning' | 'destructive' | 'secondary'
> = {
  pending_submission: 'warning',
  submitted: 'warning',
  active: 'success',
  cancelled: 'destructive',
  failed: 'destructive',
  expired: 'secondary',
};

/** True for a status the tenant should see a "set up DD" CTA on. */
export const MANDATE_NEEDS_SETUP: Record<GoCardlessMandateStatus, boolean> = {
  pending_submission: false,
  submitted: false,
  active: false,
  cancelled: true,
  failed: true,
  expired: true,
};

/**
 * GoCardless payment failure reasons we map to user-facing copy. The
 * webhook handler stamps the raw reason on the rent_payments row's
 * notes; the UI calls `paymentFailureCopy()` to render it.
 *
 * Anything we haven't seen falls back to `unknown` — never crash on
 * an unrecognised cause-string.
 *
 * Reference: https://developer.gocardless.com/api-reference/#core-endpoints-payments
 */
export type GcPaymentFailureReason =
  | 'insufficient_funds'
  | 'mandate_cancelled'
  | 'bank_account_closed'
  | 'customer_disputed'
  | 'refer_to_payer'
  | 'authorisation_disputed'
  | 'instruction_cancelled'
  | 'unknown';

export const GC_FAILURE_REASON_LABEL: Record<GcPaymentFailureReason, string> = {
  insufficient_funds: 'Insufficient funds in tenant account',
  mandate_cancelled: 'Mandate was cancelled before collection',
  bank_account_closed: 'Tenant bank account is closed',
  customer_disputed: 'Tenant disputed the payment with their bank',
  refer_to_payer: 'Bank asked the tenant to contact them',
  authorisation_disputed: 'Bank disputed the mandate authorisation',
  instruction_cancelled: 'Tenant cancelled the Direct Debit instruction',
  unknown: 'Direct Debit collection failed',
};

/** Tenant-side guidance per failure reason. */
export const GC_FAILURE_TENANT_HINT: Record<GcPaymentFailureReason, string> = {
  insufficient_funds:
    'Top up your account and ask your landlord to retry, or pay manually for this period.',
  mandate_cancelled:
    'Your Direct Debit was cancelled. Set up a new one to keep automatic collection going.',
  bank_account_closed:
    'Your bank account on file is closed. Set up a new Direct Debit with a current account.',
  customer_disputed: 'You disputed this payment with your bank. Contact your landlord to resolve.',
  refer_to_payer: 'Your bank flagged the collection. Contact them, then retry.',
  authorisation_disputed:
    'Your bank rejected the mandate. Re-authorise the Direct Debit to continue.',
  instruction_cancelled:
    'You cancelled the Direct Debit instruction at your bank. Set up a new one if you still want auto-pay.',
  unknown: 'Please contact your landlord — they will help you resolve this.',
};

/** Human-readable name for the payment provider. */
export const PAYMENT_PROVIDER_LABEL = {
  gocardless: 'GoCardless',
  truelayer: 'TrueLayer',
} as const;

/** Charge-amount thresholds for arrears-stage UI badges (used by the
 * landlord dashboard widget). Pence. Phase E owns this elsewhere; we
 * re-export from here so the new payments module has a single import. */
export const ARREARS_STAGES = {
  /** > 0p — any arrears. */
  any: 1,
  /** ~14d standard nudge threshold. */
  nudge: 1,
  /** > 1 month rent: ~£1500 in pence is a heuristic; UI should compare
   * `arrears_pence > rent_pence` instead, this is a fallback. */
  late: 100_000,
  /** > 2 months rent — Renters' Rights Bill ground-8 awareness. */
  serious: 200_000,
} as const;
