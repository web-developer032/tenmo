import 'server-only';

/**
 * Platform integration health probes for /admin.
 *
 * Each probe issues a HEAD request against the upstream provider with
 * a short timeout (default 1.5s). The result is cached in-process per
 * minute so a re-render doesn't fan out N requests; failures degrade
 * gracefully to `unknown` (presence of credentials in env) rather than
 * `outage` so a dev box without internet egress doesn't display a sea
 * of red.
 *
 * The four buckets:
 *   operational - 2xx response received
 *   degraded    - 3xx/4xx response received (provider reachable but
 *                 returning client-error to a HEAD probe — usually a
 *                 missing auth on Tenantly's side rather than an
 *                 outage)
 *   outage      - request timed out or failed at the transport layer
 *   unknown     - probe wasn't attempted (no credentials / disabled)
 *
 * Adding a new service:
 *   1. add a `Probe` entry below
 *   2. wire any required env vars into the `precondition`
 *   3. the UI picks it up automatically.
 */

export type HealthStatus = 'operational' | 'degraded' | 'outage' | 'unknown';

export type HealthService = {
  id: string;
  name: string;
  status: HealthStatus;
  detail: string;
  checked_at: string;
};

type Probe = {
  id: string;
  name: string;
  url: string;
  precondition?: () => { ok: true } | { ok: false; reason: string };
};

const PROBES: Probe[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    url: 'https://api.stripe.com/healthcheck',
    precondition: () => {
      const v = process.env.STRIPE_SECRET_KEY;
      return v && v.length > 0
        ? { ok: true }
        : { ok: false, reason: 'STRIPE_SECRET_KEY missing' };
    },
  },
  {
    id: 'gocardless',
    name: 'GoCardless',
    url:
      process.env.GOCARDLESS_ENVIRONMENT === 'live'
        ? 'https://api.gocardless.com/'
        : 'https://api-sandbox.gocardless.com/',
    precondition: () => {
      const v = process.env.GOCARDLESS_ACCESS_TOKEN;
      return v && v.length > 0
        ? { ok: true }
        : { ok: false, reason: 'GOCARDLESS_ACCESS_TOKEN missing' };
    },
  },
  {
    id: 'truelayer',
    name: 'TrueLayer',
    url: (process.env.TRUELAYER_CLIENT_ID ?? '').startsWith('sandbox-')
      ? 'https://auth.truelayer-sandbox.com/'
      : 'https://auth.truelayer.com/',
    precondition: () => {
      const id = process.env.TRUELAYER_CLIENT_ID;
      const sec = process.env.TRUELAYER_CLIENT_SECRET;
      return id && id.length > 0 && sec && sec.length > 0
        ? { ok: true }
        : { ok: false, reason: 'TRUELAYER credentials missing' };
    },
  },
  {
    id: 'resend',
    name: 'Resend',
    url: 'https://api.resend.com/',
    precondition: () => {
      const v = process.env.RESEND_API_KEY;
      return v && v.length > 0 ? { ok: true } : { ok: false, reason: 'RESEND_API_KEY missing' };
    },
  },
  {
    id: 'docuseal',
    name: 'DocuSeal',
    url: process.env.DOCUSEAL_API_URL ?? 'http://localhost:3030',
    precondition: () => {
      const v = process.env.DOCUSEAL_API_URL;
      return v && v.startsWith('http')
        ? { ok: true }
        : { ok: false, reason: 'DOCUSEAL_API_URL missing' };
    },
  },
  {
    id: 'supabase',
    name: 'Supabase',
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/auth/v1/health`,
    precondition: () => {
      const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
      return v && v.startsWith('http')
        ? { ok: true }
        : { ok: false, reason: 'SUPABASE_URL not set' };
    },
  },
];

const PROBE_TIMEOUT_MS = 1_500;
const CACHE_TTL_MS = 60_000;

let cache: { storedAt: number; rows: HealthService[] } | null = null;

async function fetchProbe(probe: Probe): Promise<HealthService> {
  const now = new Date().toISOString();
  if (probe.precondition) {
    const pre = probe.precondition();
    if (!pre.ok) {
      return {
        id: probe.id,
        name: probe.name,
        status: 'unknown',
        detail: pre.reason,
        checked_at: now,
      };
    }
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(probe.url, {
      method: 'HEAD',
      signal: ctrl.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (res.ok) {
      return {
        id: probe.id,
        name: probe.name,
        status: 'operational',
        detail: `${res.status}`,
        checked_at: now,
      };
    }
    return {
      id: probe.id,
      name: probe.name,
      status: 'degraded',
      detail: `HTTP ${res.status}`,
      checked_at: now,
    };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : 'unknown error';
    if (msg.includes('aborted')) {
      return {
        id: probe.id,
        name: probe.name,
        status: 'outage',
        detail: 'Timed out',
        checked_at: now,
      };
    }
    // Network unreachable: fall back to "unknown" rather than "outage"
    // so dev machines without internet don't see scary red pills.
    return {
      id: probe.id,
      name: probe.name,
      status: 'unknown',
      detail: 'Probe unreachable',
      checked_at: now,
    };
  }
}

export async function loadPlatformHealthProbes(): Promise<HealthService[]> {
  if (cache && Date.now() - cache.storedAt < CACHE_TTL_MS) {
    return cache.rows;
  }
  const rows = await Promise.all(PROBES.map(fetchProbe));
  cache = { storedAt: Date.now(), rows };
  return rows;
}
