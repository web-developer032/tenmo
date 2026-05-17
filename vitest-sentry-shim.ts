/**
 * Vitest stub for `@sentry/nextjs`. The real SDK pulls in the
 * full OpenTelemetry instrumentation at import time, which
 * pushes our worker startup beyond the pool timeout. Tests
 * never want to talk to Sentry anyway — we exercise our
 * `lib/observability/sentry.ts` thin wrapper, not the SDK.
 *
 * Add new exports here whenever a new caller is wired up.
 */

export const captureException = () => {};
export const captureMessage = () => {};
export const captureRequestError = () => {};
export const setUser = () => {};
export const init = () => {};
export const replayIntegration = () => ({});
export const withSentryConfig = (config: unknown) => config;
