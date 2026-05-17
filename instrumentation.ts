import * as Sentry from '@sentry/nextjs';

/**
 * Next.js `instrumentation.ts` entry point — runs once per
 * runtime (Node.js or Edge) before any requests are served.
 * Used to bootstrap Sentry on the server.
 *
 * The browser SDK lives in `instrumentation-client.ts`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * `onRequestError` is the new Next 15+ hook for capturing nested
 * RSC / Route Handler errors that don't bubble out of the
 * runtime. Forwarding to Sentry keeps the trace context intact.
 */
export const onRequestError = Sentry.captureRequestError;
