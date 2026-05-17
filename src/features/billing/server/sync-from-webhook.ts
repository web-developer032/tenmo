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

  if (existing.status !== 'past_due') {
    const { error: upErr } = await sb
      .from('org_subscriptions')
      .update({ status: 'past_due', last_synced_at: new Date().toISOString() })
      .eq('org_id', existing.org_id);
    if (upErr) throw upErr;
  }
  await notifyOrgPastDue(existing.org_id);
  return { applied: true, kind: 'past_due_marked', org_id: existing.org_id };
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<WebhookSyncResult> {
  const subscriptionId = extractSubscriptionId(invoice);
  if (!subscriptionId) {
    return { applied: false, kind: 'noop', org_id: null };
  }
  // The follow-up `customer.subscription.updated` event will carry the
  // refreshed period_end + status, so we don't need to mutate here.
  // We just stamp last_synced_at so the dashboard reflects the
  // most-recent successful billing event.
  const sb = createServiceClient();
  const { data: existing } = await sb
    .from('org_subscriptions')
    .select('org_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  if (!existing) return { applied: false, kind: 'noop', org_id: null };
  await sb
    .from('org_subscriptions')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('org_id', existing.org_id);
  return { applied: true, kind: 'subscription_upserted', org_id: existing.org_id };
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
