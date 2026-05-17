import 'server-only';
import { getServerEnv } from '@/lib/env.server';
import { AppError, ErrorCode } from '@/lib/errors';
import type { GcCustomer, GcMandate, GcPayment, GcRedirectFlow } from './types';

/**
 * Hand-rolled GoCardless REST client.
 *
 * - Lazy: never instantiated at import time (so a dev env without
 *   `GOCARDLESS_ACCESS_TOKEN` doesn't crash unrelated routes).
 * - Sandbox vs live picked from `GOCARDLESS_ENVIRONMENT`.
 * - Idempotency-Key support — every mutating call passes one through
 *   so retries on the same payload are safe (GC dedupes for 24h).
 * - Throws `AppError` on non-2xx responses with the GC error code +
 *   message preserved in `details`.
 *
 * We deliberately avoid the official SDK; see `types.ts` for rationale.
 */

const SANDBOX_BASE = 'https://api-sandbox.gocardless.com';
const LIVE_BASE = 'https://api.gocardless.com';
const GC_API_VERSION = '2015-07-06';

export class GoCardlessNotConfiguredError extends AppError {
  constructor() {
    super(
      503,
      ErrorCode.integration_error,
      'GoCardless is not configured. Set GOCARDLESS_ACCESS_TOKEN to enable Direct Debit.',
    );
    this.name = 'GoCardlessNotConfiguredError';
  }
}

interface GcRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  /** Top-level wrapping key GC expects on writes (e.g. `redirect_flows`). */
  bodyKey?: string;
  idempotencyKey?: string;
}

interface GcClientConfig {
  token: string;
  baseUrl: string;
}

let cached: GcClientConfig | null = null;

function getConfig(): GcClientConfig {
  if (cached) return cached;
  const env = getServerEnv();
  if (!env.GOCARDLESS_ACCESS_TOKEN) {
    throw new GoCardlessNotConfiguredError();
  }
  cached = {
    token: env.GOCARDLESS_ACCESS_TOKEN,
    baseUrl: env.GOCARDLESS_ENVIRONMENT === 'live' ? LIVE_BASE : SANDBOX_BASE,
  };
  return cached;
}

/**
 * Low-level request. Most callers should use the typed helpers below.
 *
 * `responseKey` is the top-level GC envelope key to unwrap (e.g.
 * `redirect_flows`). Keep this and `bodyKey` separate because some
 * endpoints have different request/response keys.
 */
async function gcRequest<T>(opts: GcRequestOptions, responseKey: string): Promise<T> {
  const cfg = getConfig();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.token}`,
    'GoCardless-Version': GC_API_VERSION,
    Accept: 'application/json',
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.idempotencyKey) {
    headers['Idempotency-Key'] = opts.idempotencyKey;
  }

  const wrappedBody =
    opts.body !== undefined && opts.bodyKey
      ? JSON.stringify({ [opts.bodyKey]: opts.body })
      : opts.body !== undefined
        ? JSON.stringify(opts.body)
        : undefined;

  const url = `${cfg.baseUrl}${opts.path}`;
  const res = await fetch(url, {
    method: opts.method,
    headers,
    body: wrappedBody,
    cache: 'no-store',
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // GC always returns JSON on errors; non-JSON means networking issue.
    throw new AppError(
      502,
      ErrorCode.integration_error,
      `GoCardless returned non-JSON (status ${res.status})`,
      { body: text.slice(0, 500) },
    );
  }

  if (!res.ok) {
    const error = (json as { error?: { code?: number; message?: string; type?: string } })?.error;
    throw new AppError(
      res.status >= 500 ? 502 : res.status,
      ErrorCode.integration_error,
      `GoCardless: ${error?.message ?? `request failed (${res.status})`}`,
      {
        gc_status: res.status,
        gc_error: error,
        path: opts.path,
      },
    );
  }

  const wrapped = (json ?? {}) as Record<string, unknown>;
  return wrapped[responseKey] as T;
}

// ============================================================================
// Redirect Flows
// ============================================================================

export interface CreateRedirectFlowInput {
  description: string;
  session_token: string;
  success_redirect_url: string;
  prefilled_customer?: {
    given_name?: string;
    family_name?: string;
    email?: string;
  };
  metadata?: Record<string, string>;
}

export async function createRedirectFlow(
  input: CreateRedirectFlowInput,
  idempotencyKey?: string,
): Promise<GcRedirectFlow> {
  return gcRequest<GcRedirectFlow>(
    {
      method: 'POST',
      path: '/redirect_flows',
      body: input,
      bodyKey: 'redirect_flows',
      idempotencyKey,
    },
    'redirect_flows',
  );
}

export interface CompleteRedirectFlowInput {
  session_token: string;
}

export async function completeRedirectFlow(
  redirectFlowId: string,
  input: CompleteRedirectFlowInput,
): Promise<GcRedirectFlow> {
  return gcRequest<GcRedirectFlow>(
    {
      method: 'POST',
      path: `/redirect_flows/${encodeURIComponent(redirectFlowId)}/actions/complete`,
      body: { data: input },
    },
    'redirect_flows',
  );
}

// ============================================================================
// Customers / Mandates
// ============================================================================

export async function getCustomer(customerId: string): Promise<GcCustomer> {
  return gcRequest<GcCustomer>(
    { method: 'GET', path: `/customers/${encodeURIComponent(customerId)}` },
    'customers',
  );
}

export async function getMandate(mandateId: string): Promise<GcMandate> {
  return gcRequest<GcMandate>(
    { method: 'GET', path: `/mandates/${encodeURIComponent(mandateId)}` },
    'mandates',
  );
}

export async function cancelMandate(mandateId: string): Promise<GcMandate> {
  return gcRequest<GcMandate>(
    {
      method: 'POST',
      path: `/mandates/${encodeURIComponent(mandateId)}/actions/cancel`,
    },
    'mandates',
  );
}

// ============================================================================
// Payments
// ============================================================================

export interface CreatePaymentInput {
  amount: number;
  currency: 'GBP';
  description: string;
  charge_date?: string;
  metadata?: Record<string, string>;
  links: { mandate: string };
}

export async function createPayment(
  input: CreatePaymentInput,
  idempotencyKey: string,
): Promise<GcPayment> {
  return gcRequest<GcPayment>(
    {
      method: 'POST',
      path: '/payments',
      body: input,
      bodyKey: 'payments',
      idempotencyKey,
    },
    'payments',
  );
}

export async function getPayment(paymentId: string): Promise<GcPayment> {
  return gcRequest<GcPayment>(
    { method: 'GET', path: `/payments/${encodeURIComponent(paymentId)}` },
    'payments',
  );
}

/** Internal helper exposed for tests — clears the cached config so a
 * test can re-init with a different env. */
export function _resetGoCardlessClientForTests(): void {
  cached = null;
}
