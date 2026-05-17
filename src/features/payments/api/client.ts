/**
 * Browser API client for the payments domain.
 *
 * Mirrors the pattern in `features/billing/api/client.ts` — this file
 * never imports the GoCardless SDK; it just calls our own API routes
 * and lets the server do the secret-bearing work.
 */

import type { GoCardlessMandate } from '@/core/schemas/payments';

export class PaymentsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'PaymentsApiError';
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string; code?: string; details?: unknown };
  } | null;
  if (!res.ok || !json || !('data' in json) || json.data === undefined) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    throw new PaymentsApiError(msg, res.status, json?.error?.code, json?.error?.details);
  }
  return json.data as T;
}

export async function startMandateApi(input: {
  tenancy_id: string;
}): Promise<{ redirect_url: string; mandate_id: string }> {
  const res = await fetch('/api/payments/mandates', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap(res);
}

export async function completeMandateApi(input: {
  redirect_flow_id: string;
}): Promise<GoCardlessMandate> {
  const res = await fetch(
    `/api/payments/mandates/${encodeURIComponent(input.redirect_flow_id)}/complete`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  return unwrap(res);
}

export async function cancelMandateApi(input: { mandate_id: string }): Promise<GoCardlessMandate> {
  const res = await fetch(`/api/payments/mandates/${encodeURIComponent(input.mandate_id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  return unwrap(res);
}

export async function collectChargeApi(input: {
  charge_id: string;
  amount_pence?: number;
  charge_date?: string;
}): Promise<{ status: string; payment_id?: string; gc_payment_id?: string; reason?: string }> {
  const { charge_id, ...body } = input;
  const res = await fetch(`/api/payments/charges/${encodeURIComponent(charge_id)}/collect`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return unwrap(res);
}
