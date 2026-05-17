import type Stripe from 'stripe';
import type { SubscriptionStatus } from '@/core/constants/billing';

/**
 * Pure mapping helpers extracted from `sync-from-webhook.ts` so they
 * can be unit-tested without spinning up a Supabase / Stripe mock.
 *
 * No `server-only` directive: this module pulls in `Stripe` only as a
 * type (erased at build-time) and carries no secrets, so it's safe to
 * be tree-shaken into either bundle.
 *
 *   - mapStripeStatus: collapse Stripe's subscription status enum to
 *     ours (we don't distinguish `incomplete` vs `incomplete_expired`).
 *   - extractSubscriptionId: defensively read the subscription id off
 *     an Invoice across legacy + dahlia API shapes.
 */

export function mapStripeStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'unpaid':
      return 'unpaid';
    case 'incomplete':
    case 'incomplete_expired':
      return 'incomplete';
    case 'paused':
      return 'incomplete';
    default:
      return 'incomplete';
  }
}

export function extractSubscriptionId(invoice: Stripe.Invoice): string | null {
  // Older Stripe API versions exposed `invoice.subscription`. Newer
  // ones (dahlia and on) move it under
  // `invoice.parent.subscription_details.subscription`. Defensively
  // read both shapes so a Stripe API bump doesn't break us.
  const legacy = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  if (typeof legacy === 'string') return legacy;
  if (legacy && typeof legacy === 'object' && 'id' in legacy) return legacy.id;
  const parent = (
    invoice as unknown as {
      parent?: { subscription_details?: { subscription?: string | { id: string } } };
    }
  ).parent;
  const sub = parent?.subscription_details?.subscription;
  if (typeof sub === 'string') return sub;
  if (sub && typeof sub === 'object' && 'id' in sub) return sub.id;
  return null;
}
