import type { NextRequest } from 'next/server';
import { getServerEnv } from '@/lib/env.server';

/**
 * Authenticate a request to a `/api/cron/*` route.
 *
 * Production: must include `Authorization: Bearer <CRON_SECRET>`.
 * Vercel Cron sets this header automatically when the matching env var is
 * configured on the project.
 *
 * Local dev: if `CRON_SECRET` is unset, requests from `127.0.0.1` / `::1`
 * are accepted so you can `curl http://localhost:3000/api/cron/...`.
 */
export type CronAuthResult = { ok: true } | { ok: false; status: 401 | 403; reason: string };

export function authenticateCron(req: NextRequest): CronAuthResult {
  const env = getServerEnv();
  const auth = req.headers.get('authorization');

  if (env.CRON_SECRET) {
    if (auth === `Bearer ${env.CRON_SECRET}`) return { ok: true };
    return { ok: false, status: 401, reason: 'Invalid or missing cron secret' };
  }

  // No secret configured — only allow localhost for dev convenience.
  const host = req.headers.get('x-forwarded-for') ?? req.headers.get('host') ?? '';
  const isLocal = host.startsWith('127.') || host.startsWith('::1') || host.startsWith('localhost');
  if (isLocal) return { ok: true };

  return { ok: false, status: 403, reason: 'CRON_SECRET not configured' };
}
