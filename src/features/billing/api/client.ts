/**
 * Browser API client for billing.
 *
 * Server modules under `features/billing/server/*` import the Stripe
 * SDK directly. This client never touches Stripe — it just hits our
 * own API and lets the server do the secret-bearing work.
 */

import type { BillingInterval, SubscriptionTier } from '@/core/constants/billing';

class BillingApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'BillingApiError';
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string; code?: string; details?: unknown };
  } | null;
  if (!res.ok || !json || !('data' in json) || json.data === undefined) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    throw new BillingApiError(msg, res.status, json?.error?.code, json?.error?.details);
  }
  return json.data as T;
}

export async function startCheckoutApi(input: {
  org_id: string;
  tier: Exclude<SubscriptionTier, 'free'>;
  interval: BillingInterval;
}): Promise<{ url: string }> {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap<{ url: string }>(res);
}

export async function openPortalApi(input: { org_id: string }): Promise<{ url: string }> {
  const res = await fetch('/api/billing/portal', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap<{ url: string }>(res);
}

export { BillingApiError };
