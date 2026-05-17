import 'server-only';
import type Stripe from 'stripe';
import { getServerEnv } from '@/lib/env.server';
import { AppError, ErrorCode } from '@/lib/errors';
import { getStripeClient } from './client';

/**
 * Webhook helpers — keep `app/api/webhooks/stripe/route.ts` thin.
 *
 * `verifyStripeEvent` parses + signature-checks the raw request body
 * with Stripe's SDK. The signing secret comes from env; if not set we
 * deliberately throw — webhook routes must never accept unsigned
 * payloads, even in dev.
 */

export class StripeWebhookSecretMissingError extends AppError {
  constructor() {
    super(
      503,
      ErrorCode.integration_error,
      'Stripe webhook secret is not configured. Set STRIPE_WEBHOOK_SECRET.',
    );
    this.name = 'StripeWebhookSecretMissingError';
  }
}

export function verifyStripeEvent(rawBody: string, signature: string | null): Stripe.Event {
  const env = getServerEnv();
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new StripeWebhookSecretMissingError();
  }
  if (!signature) {
    throw new AppError(400, ErrorCode.bad_request, 'Missing Stripe-Signature header');
  }
  const stripe = getStripeClient();
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    throw new AppError(
      400,
      ErrorCode.bad_request,
      `Invalid Stripe signature: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }
}

/** Subscription lifecycle event types we care about. */
export const SUBSCRIPTION_EVENT_TYPES = new Set<Stripe.Event['type']>([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
]);

/** True when the event type is one we should sync to org_subscriptions. */
export function isSubscriptionLifecycleEvent(type: string): boolean {
  return SUBSCRIPTION_EVENT_TYPES.has(type as Stripe.Event['type']);
}
