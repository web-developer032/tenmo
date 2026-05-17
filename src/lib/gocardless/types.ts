/**
 * Narrow type definitions for the GoCardless resources we touch.
 *
 * We deliberately avoid the official `gocardless-nodejs` SDK because:
 *   1. It has a heavy dependency footprint (axios + 20-odd transitives)
 *      that we don't want in the Edge runtime.
 *   2. We only need ~5 endpoints, all simple JSON over HTTPS.
 *   3. Hand-rolled types let us narrow exactly the fields the
 *      reconciliation logic touches, so changes in the GC API don't
 *      silently break us — TypeScript notices.
 *
 * Reference: https://developer.gocardless.com/api-reference/
 */

export interface GcRedirectFlow {
  id: string;
  redirect_url: string;
  scheme?: string;
  description: string | null;
  session_token: string;
  links: {
    creditor?: string;
    customer?: string;
    customer_bank_account?: string;
    mandate?: string;
  };
  created_at: string;
}

export interface GcCustomer {
  id: string;
  email: string | null;
  given_name: string | null;
  family_name: string | null;
  metadata: Record<string, string> | null;
  created_at: string;
}

export type GcMandateStatus =
  | 'pending_customer_approval'
  | 'pending_submission'
  | 'submitted'
  | 'active'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'consumed'
  | 'blocked';

export interface GcMandate {
  id: string;
  scheme: string;
  status: GcMandateStatus;
  reference: string | null;
  metadata: Record<string, string> | null;
  links: {
    creditor?: string;
    customer: string;
    customer_bank_account?: string;
  };
  created_at: string;
}

export type GcPaymentStatus =
  | 'pending_customer_approval'
  | 'pending_submission'
  | 'submitted'
  | 'confirmed'
  | 'paid_out'
  | 'cancelled'
  | 'customer_approval_denied'
  | 'failed'
  | 'charged_back';

export interface GcPayment {
  id: string;
  amount: number;
  currency: string;
  status: GcPaymentStatus;
  charge_date: string;
  description: string | null;
  metadata: Record<string, string> | null;
  links: {
    creditor?: string;
    mandate: string;
    payout?: string;
  };
  created_at: string;
}

/** A single event from the webhook envelope. */
export interface GcWebhookEvent {
  id: string;
  created_at: string;
  resource_type: 'mandates' | 'payments' | 'subscriptions' | 'payouts' | 'refunds' | string;
  action: string;
  details: {
    origin?: string;
    cause?: string;
    description?: string;
    scheme?: string;
    reason_code?: string;
  };
  metadata?: Record<string, string>;
  links: {
    mandate?: string;
    payment?: string;
    customer?: string;
    payout?: string;
    refund?: string;
    subscription?: string;
    [k: string]: string | undefined;
  };
}

export interface GcWebhookEnvelope {
  events: GcWebhookEvent[];
  meta?: { webhook_id?: string };
}
