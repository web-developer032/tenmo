import 'server-only';
import type Stripe from 'stripe';
import type { SubscriptionTier } from '@/core/constants/billing';
import { getLogger } from '@/lib/logger';
import { tierFromPriceId } from '@/lib/stripe/client';
import { createServiceClient } from '@/lib/supabase/service';
import { notifyOrgPastDue } from './notify-past-due';
import { extractSubscriptionId, mapStripeStatus } from './webhook-mapping';

/**
 * Apply a verified Stripe webhook event to `org_subscriptions`.
 *
 * Idempotency:
 *   * The webhook route persists every event to `webhook_events` keyed
 *     by (provider, event_id) BEFORE calling this function. If the
 *     same event arrives twice (Stripe retries), the route short-
 *     circuits and never invokes us — so we don't need to dedupe
 *     ourselves. We still write `processed_at` after success so the
 *     audit log is honest about which deliveries actually mutated state.
 *
 * Routing:
 *   * Subscription rows → look up `org_subscriptions` by stripe IDs and
 *     update the row in place.
 *   * `checkout.session.completed` → grab the org id from the session
 *     metadata + the subscription id, then re-fetch the subscription
 *     from Stripe to get the canonical state.
 *   * `invoice.payment_failed` → flip status to past_due (Stripe also
 *     sends `customer.subscription.updated` shortly after, but doing it
 *     here too makes the past-due notification fire instantly).
 *   * Anything else → no-op (logged at debug).
 *
 * Error handling: throws on hard failures (DB error, missing org,
 * Stripe API errors). The webhook route catches those, leaves
 * `processed_at` null, and returns 500 so Stripe retries. Soft
 * problems (event we don't care about, missing metadata) just log
 * and return.
 */
const log = () => getLogger().child({ module: 'billing.sync-from-webhook' });

export type WebhookSyncResult = {
  applied: boolean;
  /** What kind of update was made — useful for log filters / tests. */
  kind: 'subscription_upserted' | 'past_due_marked' | 'noop';
  org_id: string | null;
};

export async function applyStripeWebhookEvent(event: Stripe.Event): Promise<WebhookSyncResult> {
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutCompleted(event);
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return handleSubscriptionRow(event.data.object as Stripe.Subscription);
    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
    case 'invoice.payment_succeeded':
      return handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
    case 'payment_method.attached':
    case 'payment_method.updated':
      return handlePaymentMethodEvent(event.data.object as Stripe.PaymentMethod);
    case 'customer.updated':
      return handleCustomerUpdated(event.data.object as Stripe.Customer);
    default:
      log().debug({ type: event.type }, 'event type ignored');
      return { applied: false, kind: 'noop', org_id: null };
  }
}

async function handleCheckoutCompleted(event: Stripe.Event): Promise<WebhookSyncResult> {
  const session = event.data.object as Stripe.Checkout.Session;
  const orgId =
    session.client_reference_id ?? (session.metadata?.org_id as string | undefined) ?? null;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : (session.subscription?.id ?? null);

  if (!orgId) {
    log().warn({ sessionId: session.id }, 'checkout.session.completed missing org id');
    return { applied: false, kind: 'noop', org_id: null };
  }

  if (!subscriptionId) {
    log().info(
      { sessionId: session.id, orgId },
      'checkout.session.completed has no subscription yet — waiting for customer.subscription.created',
    );
    return { applied: false, kind: 'noop', org_id: orgId };
  }

  // Re-fetch the subscription so we work from canonical Stripe state
  // even if the embedded payload is stale.
  const { getStripeClient } = await import('@/lib/stripe/client');
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return upsertSubscriptionRow({ subscription, orgIdFromMetadata: orgId });
}

async function handleSubscriptionRow(
  subscription: Stripe.Subscription,
): Promise<WebhookSyncResult> {
  const orgIdFromMetadata = (subscription.metadata?.org_id as string | undefined) ?? null;
  return upsertSubscriptionRow({ subscription, orgIdFromMetadata });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<WebhookSyncResult> {
  const subscriptionId = extractSubscriptionId(invoice);
  if (!subscriptionId) {
    log().debug({ invoiceId: invoice.id }, 'payment_failed without subscription — ignoring');
    return { applied: false, kind: 'noop', org_id: null };
  }

  const sb = createServiceClient();
  const { data: existing, error } = await sb
    .from('org_subscriptions')
    .select('org_id, status')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  if (error) throw error;
  if (!existing) {
    log().warn({ subscriptionId }, 'invoice.payment_failed for unknown subscription');
    return { applied: false, kind: 'noop', org_id: null };
  }

  const update: Record<string, unknown> = {
    last_payment_status: 'failed',
    last_payment_failure_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
  };
  if (existing.status !== 'past_due') {
    update.status = 'past_due';
  }
  const { error: upErr } = await sb
    .from('org_subscriptions')
    .update(update)
    .eq('org_id', existing.org_id);
  if (upErr) throw upErr;
  await notifyOrgPastDue(existing.org_id);
  return { applied: true, kind: 'past_due_marked', org_id: existing.org_id };
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<WebhookSyncResult> {
  const subscriptionId = extractSubscriptionId(invoice);
  if (!subscriptionId) {
    return { applied: false, kind: 'noop', org_id: null };
  }
  // The follow-up `customer.subscription.updated` event will carry the
  // refreshed period_end + status, so we don't need to mutate those here.
  // We still record the successful payment + MRR so the admin dashboard's
  // billing column shows the most recent state without round-tripping
  // Stripe.
  const sb = createServiceClient();
  const { data: existing } = await sb
    .from('org_subscriptions')
    .select('org_id, mrr_pence')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  if (!existing) return { applied: false, kind: 'noop', org_id: null };

  const amountPaid = (invoice.amount_paid ?? 0) as number;
  const update: Record<string, unknown> = {
    last_payment_status: 'paid',
    last_synced_at: new Date().toISOString(),
  };
  // `amount_paid` is the line-item total in pence for the period. We
  // surface it as `mrr_pence` for monthly invoices; annual invoices
  // would distort the dashboard so we only update if the invoice
  // billing_reason was a recurring monthly cycle.
  const firstLine = invoice.lines?.data?.[0];
  const pricing = (firstLine as unknown as { pricing?: { price_details?: { type?: string } } })
    ?.pricing;
  const interval =
    (firstLine as unknown as { price?: { recurring?: { interval?: string } } })?.price?.recurring
      ?.interval ?? null;
  if (
    invoice.billing_reason === 'subscription_cycle' &&
    (interval === 'month' || pricing?.price_details?.type === 'recurring') &&
    amountPaid > 0
  ) {
    update.mrr_pence = amountPaid;
  }
  await sb.from('org_subscriptions').update(update).eq('org_id', existing.org_id);
  return { applied: true, kind: 'subscription_upserted', org_id: existing.org_id };
}

/**
 * Update `payment_method_*` columns when Stripe attaches or updates a
 * card on the customer. We resolve the org via the customer id (set
 * during checkout). Best-effort — if the customer isn't on file we
 * just log + skip.
 */
async function handlePaymentMethodEvent(
  pm: Stripe.PaymentMethod,
): Promise<WebhookSyncResult> {
  if (pm.type !== 'card' || !pm.card) {
    return { applied: false, kind: 'noop', org_id: null };
  }
  const customerId =
    typeof pm.customer === 'string' ? pm.customer : (pm.customer?.id ?? null);
  if (!customerId) {
    return { applied: false, kind: 'noop', org_id: null };
  }
  const sb = createServiceClient();
  const { data: existing } = await sb
    .from('org_subscriptions')
    .select('org_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (!existing) {
    log().info({ customerId }, 'payment_method event for unknown customer — ignoring');
    return { applied: false, kind: 'noop', org_id: null };
  }
  await sb
    .from('org_subscriptions')
    .update({
      payment_method_brand: pm.card.brand,
      payment_method_last4: pm.card.last4,
      last_synced_at: new Date().toISOString(),
    })
    .eq('org_id', existing.org_id);
  return { applied: true, kind: 'subscription_upserted', org_id: existing.org_id };
}

/**
 * Mirror the customer's default invoice card back onto the row. Triggered
 * when the customer updates their default payment method in the Stripe
 * portal (which doesn't fire a `payment_method.updated` event reliably).
 */
async function handleCustomerUpdated(
  customer: Stripe.Customer,
): Promise<WebhookSyncResult> {
  const defaultPm = customer.invoice_settings?.default_payment_method;
  if (!defaultPm) {
    return { applied: false, kind: 'noop', org_id: null };
  }
  const sb = createServiceClient();
  const { data: existing } = await sb
    .from('org_subscriptions')
    .select('org_id')
    .eq('stripe_customer_id', customer.id)
    .maybeSingle();
  if (!existing) {
    return { applied: false, kind: 'noop', org_id: null };
  }
  try {
    const { getStripeClient } = await import('@/lib/stripe/client');
    const pmId = typeof defaultPm === 'string' ? defaultPm : defaultPm.id;
    const pm = await getStripeClient().paymentMethods.retrieve(pmId);
    if (pm.type === 'card' && pm.card) {
      await sb
        .from('org_subscriptions')
        .update({
          payment_method_brand: pm.card.brand,
          payment_method_last4: pm.card.last4,
          last_synced_at: new Date().toISOString(),
        })
        .eq('org_id', existing.org_id);
      return { applied: true, kind: 'subscription_upserted', org_id: existing.org_id };
    }
  } catch (err) {
    log().warn({ err, customerId: customer.id }, 'payment-method retrieve failed');
  }
  return { applied: false, kind: 'noop', org_id: existing.org_id };
}

async function upsertSubscriptionRow(args: {
  subscription: Stripe.Subscription;
  orgIdFromMetadata: string | null;
}): Promise<WebhookSyncResult> {
  const { subscription, orgIdFromMetadata } = args;
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

  const sb = createServiceClient();

  // Resolve org id: prefer the metadata stamped at checkout-time, fall
  // back to looking up by stripe_customer_id (covers subs created
  // outside our flow, e.g. via the dashboard).
  let orgId = orgIdFromMetadata;
  if (!orgId) {
    const { data } = await sb
      .from('org_subscriptions')
      .select('org_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    orgId = data?.org_id ?? null;
  }
  if (!orgId) {
    log().warn(
      { subscriptionId: subscription.id, customerId },
      'subscription event has no resolvable org_id',
    );
    return { applied: false, kind: 'noop', org_id: null };
  }

  // Map the subscription's primary item → tier.
  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const tier: SubscriptionTier = priceId ? (tierFromPriceId(priceId) ?? 'free') : 'free';
  const status = mapStripeStatus(subscription.status);
  const periodEnd = (item?.current_period_end ?? null) as number | null;
  const trialEnd = subscription.trial_end ?? null;

  const { error } = await sb
    .from('org_subscriptions')
    .update({
      tier,
      status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      trial_end: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
      last_synced_at: new Date().toISOString(),
    })
    .eq('org_id', orgId);
  if (error) throw error;

  if (status === 'past_due') {
    await notifyOrgPastDue(orgId);
  }

  return { applied: true, kind: 'subscription_upserted', org_id: orgId };
}
