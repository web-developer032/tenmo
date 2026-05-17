import * as Sentry from '@sentry/nextjs';

/**
 * Centralised wrapper around the Sentry SDK so the rest of the
 * app can capture events without a hard dependency on the SDK
 * shape. All helpers are no-ops when Sentry isn't configured
 * (the SDK itself short-circuits, but we add a guard so unit
 * tests don't see SDK chatter either).
 */

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // Last-resort: never let observability break the request.
  }
}

export function captureMessage(message: string, context?: Record<string, unknown>): void {
  try {
    Sentry.captureMessage(message, context ? { extra: context } : undefined);
  } catch {
    /* noop */
  }
}

/** Tag the current scope with the authenticated user. Pass `null` to
 * clear the user (e.g. on sign-out). PII-safe: only the `id` is
 * sent; email + name are intentionally omitted. */
export function setSentryUser(user: { id: string } | null): void {
  try {
    Sentry.setUser(user ? { id: user.id } : null);
  } catch {
    /* noop */
  }
}
