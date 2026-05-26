import 'server-only';
import type Stripe from 'stripe';
import { getStripeClient, StripeNotConfiguredError } from '@/lib/stripe/client';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Server-side helpers for admin billing operations:
 *   - `retryLatestInvoice(orgId)` — re-attempts payment on the most recent
 *     open / failed invoice for the org's Stripe subscription.
 *   - `loadOrgStripeContext(orgId)` — utility for routes that need the org's
 *     Stripe customer + subscription IDs.
 *
 * Each helper is a no-op fail-safe: when Stripe isn't configured the caller
 * receives `{ status: 'not_configured' }` instead of a thrown error so the
 * UI can degrade gracefully and the admin audit log still records the
 * attempt.
 *
 * Live Stripe integration:
 *   * `stripe.invoices.pay()` is the cheapest retry path — it tells Stripe
 *     to attempt the on-file payment method *now* instead of waiting for
 *     the next dunning retry slot. Stripe then fans the result back to
 *     us via `invoice.payment_succeeded` / `invoice.payment_failed`
 *     webhooks, which the existing `sync-from-webhook.ts` consumes.
 */

export type StripeOrgContext = {
  orgId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  lastPaymentStatus: 'paid' | 'failed' | 'requires_action' | null;
};

export async function loadOrgStripeContext(orgId: string): Promise<StripeOrgContext> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('org_subscriptions')
    .select('stripe_customer_id, stripe_subscription_id, last_payment_status')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw error;
  return {
    orgId,
    stripeCustomerId: data?.stripe_customer_id ?? null,
    stripeSubscriptionId: data?.stripe_subscription_id ?? null,
    lastPaymentStatus:
      (data?.last_payment_status as StripeOrgContext['lastPaymentStatus']) ?? null,
  };
}

export type InvoiceRetryResult =
  | { status: 'not_configured' }
  | { status: 'no_subscription' }
  | { status: 'no_open_invoice' }
  | {
      status: 'attempted';
      invoice_id: string;
      stripe_status: Stripe.Invoice.Status | null;
      paid: boolean;
    }
  | { status: 'failed'; invoice_id: string | null; message: string };

/**
 * Retry the latest open or failed Stripe invoice for an org's subscription.
 *
 * Implementation notes:
 * - We list invoices filtered by `subscription` + statuses `open` / `uncollectable`
 *   (Stripe doesn't expose a single "failed" status; `open` covers retries
 *   and `uncollectable` is the terminal failure that Stripe still allows
 *   manual `pay()` against).
 * - When no such invoice exists (e.g. the subscription is already paid), we
 *   surface `no_open_invoice` so the UI can say "Already up to date".
 */
export async function retryLatestInvoice(orgId: string): Promise<InvoiceRetryResult> {
  let stripe: Stripe;
  try {
    stripe = getStripeClient();
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return { status: 'not_configured' };
    }
    throw err;
  }

  const ctx = await loadOrgStripeContext(orgId);
  if (!ctx.stripeSubscriptionId) {
    return { status: 'no_subscription' };
  }

  // List the latest invoices for the subscription. `open` covers invoices
  // that Stripe will still retry; `uncollectable` is the manual-retry case.
  const open = await stripe.invoices.list({
    subscription: ctx.stripeSubscriptionId,
    status: 'open',
    limit: 5,
  });
  const uncollectible = open.data.length
    ? { data: [] as Stripe.Invoice[] }
    : await stripe.invoices.list({
        subscription: ctx.stripeSubscriptionId,
        status: 'uncollectible',
        limit: 5,
      });

  const candidates: Stripe.Invoice[] = [...open.data, ...uncollectible.data].sort(
    (a, b) => (b.created ?? 0) - (a.created ?? 0),
  );
  const target = candidates[0];
  if (!target) {
    return { status: 'no_open_invoice' };
  }

  try {
    if (!target.id) {
      return { status: 'failed', invoice_id: null, message: 'Invoice id missing from Stripe' };
    }
    const paid = await stripe.invoices.pay(target.id);
    return {
      status: 'attempted',
      invoice_id: paid.id ?? target.id,
      stripe_status: paid.status,
      paid: paid.status === 'paid',
    };
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : 'Stripe invoice pay() failed';
    return { status: 'failed', invoice_id: target.id ?? null, message };
  }
}
