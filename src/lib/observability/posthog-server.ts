import 'server-only';
import { PostHog } from 'posthog-node';
import { publicEnv } from '@/lib/env.public';
import { getLogger } from '@/lib/logger';

/**
 * Server-side PostHog singleton. Returns `null` if PostHog isn't
 * configured (no key in env) so callers can fire-and-forget
 * without a hard dependency.
 *
 * The Node SDK buffers events in memory and flushes on a timer;
 * call `shutdownPostHog()` from a long-running task's `finally`
 * to drain the queue (Vercel doesn't run a true graceful
 * shutdown for serverless, so we also call `flush()` after every
 * `capture` to be safe under load).
 */

let cached: PostHog | null = null;
let initialised = false;

export function getPostHogServer(): PostHog | null {
  if (initialised) return cached;
  initialised = true;
  const key = publicEnv.NEXT_PUBLIC_POSTHOG_KEY;
  const host = publicEnv.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key) return null;
  cached = new PostHog(key, {
    host: host ?? 'https://eu.i.posthog.com',
    // 100ms flush window keeps Vercel function lifetimes short.
    flushAt: 1,
    flushInterval: 100,
  });
  return cached;
}

export async function shutdownPostHog(): Promise<void> {
  if (!cached) return;
  try {
    await cached.shutdown();
  } catch (err) {
    getLogger().warn({ err }, 'posthog-node shutdown failed');
  } finally {
    cached = null;
    initialised = false;
  }
}
