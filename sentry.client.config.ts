/**
 * Sentry SDK init for the **browser**.
 *
 * Loaded by `instrumentation-client.ts` (Next.js convention).
 * Tuning lives in `src/lib/observability/sentry-defaults.ts` so
 * client / server / edge stay in lockstep.
 */
import * as Sentry from '@sentry/nextjs';
import {
  replaysOnErrorSampleRate,
  replaysSessionSampleRate,
  sentryEnv,
  shouldIgnoreSentryEvent,
  tracesSampleRate,
} from './src/lib/observability/sentry-defaults';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const env = sentryEnv();

if (dsn) {
  Sentry.init({
    dsn,
    environment: env,
    tracesSampleRate: tracesSampleRate(env),
    replaysSessionSampleRate,
    replaysOnErrorSampleRate,
    integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],
    beforeSend(event) {
      return shouldIgnoreSentryEvent(event) ? null : event;
    },
  });
}
