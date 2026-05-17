/**
 * Browser-side instrumentation entry point. Next.js loads this
 * file before hydration, so the Sentry SDK is alive in time to
 * catch early errors.
 */
import './sentry.client.config';
