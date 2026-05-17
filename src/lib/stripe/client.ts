import 'server-only';
import Stripe from 'stripe';
import type { BillingInterval, SubscriptionTier } from '@/core/constants/billing';
import { getServerEnv } from '@/lib/env.server';
import { AppError, ErrorCode } from '@/lib/errors';

/**
 * Lazy Stripe client — never instantiated at module-import time so a
 * dev environment without `STRIPE_SECRET_KEY` won't crash unrelated
 * routes. Callers that genuinely need Stripe (checkout, portal, webhook
 * verifier) call `getStripeClient()` and get a clear 503 if the key is
 * absent.
 */

let cached: Stripe | null = null;

export class StripeNotConfiguredError extends AppError {
  constructor() {
    super(
      503,
      ErrorCode.integration_error,
      'Stripe is not configured. Set STRIPE_SECRET_KEY to enable billing.',
    );
    this.name = 'StripeNotConfiguredError';
  }
}

export function getStripeClient(): Stripe {
  if (cached) return cached;
  const env = getServerEnv();
  if (!env.STRIPE_SECRET_KEY) {
    throw new StripeNotConfiguredError();
  }
  cached = new Stripe(env.STRIPE_SECRET_KEY, {
    // Pin to a specific Stripe API version so SDK upgrades don't shift
    // payload shapes under us. Bump in lockstep with the SDK release
    // notes when we deliberately want new fields.
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
    appInfo: { name: 'Tenantly', url: 'https://tenantly.app' },
  });
  return cached;
}

/** Resolve the env-configured Stripe Price ID for a given tier+interval.
 * Throws a 503 with a clear message when the slot is empty so the UI
 * can surface "Pricing not yet configured" rather than a generic
 * Stripe error. */
export function resolveStripePriceId(
  tier: Exclude<SubscriptionTier, 'free'>,
  interval: BillingInterval,
): string {
  const env = getServerEnv();
  const map: Record<string, string | undefined> = {
    starter_monthly: env.STRIPE_PRICE_STARTER_MONTHLY,
    starter_annual: env.STRIPE_PRICE_STARTER_ANNUAL,
    pro_monthly: env.STRIPE_PRICE_PRO_MONTHLY,
    pro_annual: env.STRIPE_PRICE_PRO_ANNUAL,
    portfolio_monthly: env.STRIPE_PRICE_PORTFOLIO_MONTHLY,
    portfolio_annual: env.STRIPE_PRICE_PORTFOLIO_ANNUAL,
  };
  const key = `${tier}_${interval}`;
  const priceId = map[key];
  if (!priceId) {
    throw new AppError(
      503,
      ErrorCode.integration_error,
      `Pricing for ${tier} (${interval}) is not yet configured. Set STRIPE_PRICE_${tier.toUpperCase()}_${interval.toUpperCase()}.`,
    );
  }
  return priceId;
}

/** Reverse lookup: given a Stripe Price ID coming back from a webhook,
 * which tier does it correspond to? Returns null if not configured —
 * the webhook handler logs and ignores prices it can't map. */
export function tierFromPriceId(priceId: string): SubscriptionTier | null {
  const env = getServerEnv();
  if (priceId === env.STRIPE_PRICE_STARTER_MONTHLY || priceId === env.STRIPE_PRICE_STARTER_ANNUAL) {
    return 'starter';
  }
  if (priceId === env.STRIPE_PRICE_PRO_MONTHLY || priceId === env.STRIPE_PRICE_PRO_ANNUAL) {
    return 'pro';
  }
  if (
    priceId === env.STRIPE_PRICE_PORTFOLIO_MONTHLY ||
    priceId === env.STRIPE_PRICE_PORTFOLIO_ANNUAL
  ) {
    return 'portfolio';
  }
  return null;
}
