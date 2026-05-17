import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getServerEnv } from '@/lib/env.server';
import { RateLimitError } from '@/lib/errors';

let limiter: Ratelimit | null = null;

/**
 * Lazily create a sliding-window rate limiter on Upstash Redis.
 * Falls back to a no-op limiter if Redis env vars are unset (local dev).
 */
function getLimiter(): Ratelimit | null {
  if (limiter) return limiter;
  const env = getServerEnv();
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    analytics: true,
    prefix: 'tenantly:rl',
  });
  return limiter;
}

/**
 * Rate-limit a request by identifier. Throws `RateLimitError` if exceeded.
 */
export async function rateLimit(identifier: string): Promise<void> {
  const lim = getLimiter();
  if (!lim) return;
  const { success, reset, remaining } = await lim.limit(identifier);
  if (!success) {
    throw new RateLimitError(
      `Rate limit exceeded. Try again at ${new Date(reset).toISOString()}. Remaining: ${remaining}.`,
    );
  }
}
