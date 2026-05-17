import type Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { extractSubscriptionId, mapStripeStatus } from '../webhook-mapping';

describe('mapStripeStatus', () => {
  it('passes through the canonical statuses', () => {
    expect(mapStripeStatus('trialing')).toBe('trialing');
    expect(mapStripeStatus('active')).toBe('active');
    expect(mapStripeStatus('past_due')).toBe('past_due');
    expect(mapStripeStatus('canceled')).toBe('canceled');
    expect(mapStripeStatus('unpaid')).toBe('unpaid');
  });

  it('collapses incomplete + incomplete_expired into incomplete', () => {
    expect(mapStripeStatus('incomplete')).toBe('incomplete');
    expect(mapStripeStatus('incomplete_expired')).toBe('incomplete');
  });

  it('treats paused as incomplete (locks features)', () => {
    expect(mapStripeStatus('paused')).toBe('incomplete');
  });
});

describe('extractSubscriptionId', () => {
  it('reads the legacy top-level field (string)', () => {
    const inv = { subscription: 'sub_legacy_123' } as unknown as Stripe.Invoice;
    expect(extractSubscriptionId(inv)).toBe('sub_legacy_123');
  });

  it('reads the legacy top-level field (expanded object)', () => {
    const inv = { subscription: { id: 'sub_legacy_obj' } } as unknown as Stripe.Invoice;
    expect(extractSubscriptionId(inv)).toBe('sub_legacy_obj');
  });

  it('reads the dahlia-shaped parent.subscription_details.subscription', () => {
    const inv = {
      parent: { subscription_details: { subscription: 'sub_dahlia_123' } },
    } as unknown as Stripe.Invoice;
    expect(extractSubscriptionId(inv)).toBe('sub_dahlia_123');
  });

  it('reads dahlia shape when subscription is expanded', () => {
    const inv = {
      parent: { subscription_details: { subscription: { id: 'sub_dahlia_obj' } } },
    } as unknown as Stripe.Invoice;
    expect(extractSubscriptionId(inv)).toBe('sub_dahlia_obj');
  });

  it('returns null when no subscription is present (one-off invoice)', () => {
    const inv = {} as Stripe.Invoice;
    expect(extractSubscriptionId(inv)).toBeNull();
  });
});
