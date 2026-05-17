/**
 * Shared Sentry init defaults. Imported by the three SDK config
 * files (`sentry.client.config.ts`, `sentry.server.config.ts`,
 * `sentry.edge.config.ts`) so we never tune one and forget the
 * others.
 *
 * Pure: no Sentry import here, no side effects. The SDK config
 * files do the actual `Sentry.init(...)` and pass these values in.
 */

/** Sample 100% of errors but only 10% of traces in prod (1.0 in
 * dev). Spans are noisy and we don't yet have a budget for a
 * full-trace sampler. Tweak per the Sentry quota dashboard once
 * we have data. */
export const tracesSampleRate = (env: string | undefined): number =>
  env === 'production' ? 0.1 : 1.0;

/** Don't ship 100% of replay sessions — the bandwidth + storage
 * cost would be silly at MVP volume. Capture 10% of all sessions
 * + every session that hit an error. */
export const replaysSessionSampleRate = 0.1;
export const replaysOnErrorSampleRate = 1.0;

/** Drop noisy events before they leave the SDK. Returns null to
 * suppress; otherwise the original event. Add new patterns here
 * as we discover them — keep them surgical. */
export interface SentryEventLike {
  exception?: { values?: Array<{ type?: string; value?: string }> };
  message?: string;
  request?: { url?: string };
}

const NOISE_PATTERNS: RegExp[] = [
  // Browser extension noise.
  /Non-Error promise rejection captured/i,
  // Cancelled fetches when the user navigates away.
  /AbortError/i,
  /The user aborted a request/i,
  // ResizeObserver loop limit — benign and uncatchable in some browsers.
  /ResizeObserver loop limit exceeded/i,
];

export function shouldIgnoreSentryEvent(event: SentryEventLike): boolean {
  const msg = event.message ?? event.exception?.values?.[0]?.value ?? '';
  if (!msg) return false;
  return NOISE_PATTERNS.some((p) => p.test(msg));
}

/** Single source of truth for the env tag we send. */
export function sentryEnv(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';
}
