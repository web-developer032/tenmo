/**
 * Sentry SDK init for the **Node.js** runtime (Route Handlers,
 * server actions, RSC).
 *
 * Loaded by `instrumentation.ts`'s Node-runtime branch.
 */
import * as Sentry from '@sentry/nextjs';
import {
  sentryEnv,
  shouldIgnoreSentryEvent,
  tracesSampleRate,
} from './src/lib/observability/sentry-defaults';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
const env = sentryEnv();

if (dsn) {
  Sentry.init({
    dsn,
    environment: env,
    tracesSampleRate: tracesSampleRate(env),
    beforeSend(event) {
      return shouldIgnoreSentryEvent(event) ? null : event;
    },
  });
}
