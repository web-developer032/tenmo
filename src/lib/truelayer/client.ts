import 'server-only';
import { getServerEnv } from '@/lib/env.server';
import { AppError, ErrorCode } from '@/lib/errors';

/**
 * Lightweight TrueLayer client for tenant bank verification (Open Banking).
 *
 * Why we wrote our own:
 *   * The official `truelayer-client` package is geared at full PIS / AISP
 *     consumers; we only need three calls (token, payment link, payment
 *     status) and prefer a thin module without the wider package surface.
 *   * Lazy initialisation lets dev environments without TrueLayer creds
 *     boot the app cleanly.
 *
 * Configured via:
 *   - `TRUELAYER_CLIENT_ID`
 *   - `TRUELAYER_CLIENT_SECRET`
 *   - `TRUELAYER_WEBHOOK_SECRET` (used by `signature.ts`)
 *
 * Both sandbox (`api.truelayer-sandbox.com`) and live (`api.truelayer.com`)
 * hosts share the same auth flow — we sniff the client id (sandbox ids
 * start with `sandbox-`) to choose the right host. Override via
 * `TRUELAYER_ENVIRONMENT` if your sandbox client uses a non-default
 * prefix.
 */

const SANDBOX_AUTH_HOST = 'https://auth.truelayer-sandbox.com';
const SANDBOX_API_HOST = 'https://api.truelayer-sandbox.com';
const LIVE_AUTH_HOST = 'https://auth.truelayer.com';
const LIVE_API_HOST = 'https://api.truelayer.com';

export class TrueLayerNotConfiguredError extends AppError {
  constructor() {
    super(
      503,
      ErrorCode.integration_error,
      'TrueLayer is not configured. Set TRUELAYER_CLIENT_ID and TRUELAYER_CLIENT_SECRET.',
    );
    this.name = 'TrueLayerNotConfiguredError';
  }
}

type TlConfig = {
  clientId: string;
  clientSecret: string;
  authHost: string;
  apiHost: string;
  environment: 'sandbox' | 'live';
};

let cachedConfig: TlConfig | null = null;
let cachedToken: { value: string; expiresAt: number } | null = null;

function getConfig(): TlConfig {
  if (cachedConfig) return cachedConfig;
  const env = getServerEnv();
  if (!env.TRUELAYER_CLIENT_ID || !env.TRUELAYER_CLIENT_SECRET) {
    throw new TrueLayerNotConfiguredError();
  }
  const isSandbox = env.TRUELAYER_CLIENT_ID.startsWith('sandbox-');
  cachedConfig = {
    clientId: env.TRUELAYER_CLIENT_ID,
    clientSecret: env.TRUELAYER_CLIENT_SECRET,
    authHost: isSandbox ? SANDBOX_AUTH_HOST : LIVE_AUTH_HOST,
    apiHost: isSandbox ? SANDBOX_API_HOST : LIVE_API_HOST,
    environment: isSandbox ? 'sandbox' : 'live',
  };
  return cachedConfig;
}

/**
 * Exchange client credentials for a short-lived bearer token. The token
 * is cached in-process until ~30s before expiry so a burst of requests
 * shares one token (TrueLayer rate-limits the auth endpoint aggressively).
 */
async function getAccessToken(scope: string): Promise<string> {
  const cfg = getConfig();
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.value;
  }

  const res = await fetch(`${cfg.authHost}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new AppError(
      502,
      ErrorCode.integration_error,
      `TrueLayer auth failed (${res.status})`,
      { body: text.slice(0, 400) },
    );
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new AppError(
      502,
      ErrorCode.integration_error,
      'TrueLayer auth response missing access_token',
    );
  }
  cachedToken = {
    value: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

export interface TlPaymentInput {
  /** Amount in pence. Must be > 0. */
  amount_pence: number;
  /** Reference shown to the tenant on their bank statement (≤18 chars). */
  reference: string;
  /** Display description on the TrueLayer payment page. */
  description: string;
  /** Beneficiary (landlord platform) sort code. */
  sort_code: string;
  /** Beneficiary account number (8 digits). */
  account_number: string;
  /** Beneficiary account holder name. */
  beneficiary_name: string;
  /** User-facing return URL after the bank flow. */
  return_uri: string;
  /** Metadata round-tripped into the webhook payload. */
  metadata?: Record<string, string>;
}

export interface TlPaymentResult {
  id: string;
  resource_token: string;
  user: { id: string };
  status: string;
  /**
   * Hosted Payments Page URL — the tenant is redirected here to pick
   * their bank and authorise. TrueLayer redirects them back to
   * `return_uri` once complete.
   */
  payment_link: string;
}

export async function createPayment(input: TlPaymentInput): Promise<TlPaymentResult> {
  const cfg = getConfig();
  const token = await getAccessToken('payments');
  const res = await fetch(`${cfg.apiHost}/v3/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.reference,
    },
    body: JSON.stringify({
      amount_in_minor: input.amount_pence,
      currency: 'GBP',
      payment_method: {
        type: 'bank_transfer',
        provider_selection: { type: 'user_selected' },
        beneficiary: {
          type: 'external_account',
          account_holder_name: input.beneficiary_name,
          reference: input.reference,
          account_identifier: {
            type: 'sort_code_account_number',
            sort_code: input.sort_code,
            account_number: input.account_number,
          },
        },
      },
      user: {
        type: 'new',
        name: input.beneficiary_name,
      },
      metadata: input.metadata ?? {},
      return_uri: input.return_uri,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new AppError(
      res.status >= 500 ? 502 : res.status,
      ErrorCode.integration_error,
      `TrueLayer createPayment failed (${res.status})`,
      { body: body.slice(0, 400) },
    );
  }

  const json = (await res.json()) as {
    id?: string;
    resource_token?: string;
    status?: string;
    user?: { id?: string };
  };
  if (!json.id || !json.resource_token) {
    throw new AppError(
      502,
      ErrorCode.integration_error,
      'TrueLayer createPayment returned malformed body',
    );
  }
  const paymentLink = `${cfg.apiHost.replace('api.', 'payment.')}/payments#payment_id=${json.id}&resource_token=${json.resource_token}&return_uri=${encodeURIComponent(
    input.return_uri,
  )}`;
  return {
    id: json.id,
    resource_token: json.resource_token,
    user: { id: json.user?.id ?? '' },
    status: json.status ?? 'authorization_required',
    payment_link: paymentLink,
  };
}

export interface TlPaymentStatusResult {
  id: string;
  status:
    | 'authorization_required'
    | 'authorizing'
    | 'authorized'
    | 'executed'
    | 'settled'
    | 'failed';
  failure_stage?: string;
  failure_reason?: string;
  amount_in_minor?: number;
}

export async function getPaymentStatus(paymentId: string): Promise<TlPaymentStatusResult> {
  const cfg = getConfig();
  const token = await getAccessToken('payments');
  const res = await fetch(`${cfg.apiHost}/v3/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new AppError(
      res.status >= 500 ? 502 : res.status,
      ErrorCode.integration_error,
      `TrueLayer getPaymentStatus failed (${res.status})`,
      { body: body.slice(0, 400) },
    );
  }
  return (await res.json()) as TlPaymentStatusResult;
}

/** Reset the cached client + token. Internal helper for tests. */
export function _resetTrueLayerClientForTests(): void {
  cachedConfig = null;
  cachedToken = null;
}
