import type { NextRequest } from 'next/server';
import { replayPendingWebhookEvents } from '@/features/webhooks/server';
import { authenticateCron } from '@/lib/cron-auth';
import { getLogger } from '@/lib/logger';

/**
 * Webhook replay cron — sweeps `webhook_events` rows that never got a
 * `processed_at` and re-applies them.
 *
 * Schedule (configured in `vercel.json`): every 15 minutes.
 *
 * Behaviour:
 *   - Picks up to 25 rows per run with attempts < 5.
 *   - Per-provider apply is lazy-imported.
 *   - After 5 failed attempts a row is left alone (the audit log shows
 *     the last error). Operators can re-queue manually by resetting
 *     `attempts` to 0 + clearing `error` in the DB.
 *
 *   curl -X POST http://localhost:3000/api/cron/webhook-replay
 */
export const dynamic = 'force-dynamic';

async function run(req: NextRequest): Promise<Response> {
  const auth = authenticateCron(req);
  if (!auth.ok) {
    return Response.json(
      { error: { code: 'unauthorized', message: auth.reason } },
      { status: auth.status },
    );
  }

  const log = getLogger().child({ route: '/api/cron/webhook-replay' });
  try {
    const result = await replayPendingWebhookEvents();
    log.info(
      {
        attempted: result.attempted,
        succeeded: result.succeeded,
        failed: result.failed,
        skipped: result.skipped,
      },
      'webhook replay cron complete',
    );
    return Response.json({ data: result });
  } catch (err) {
    log.error({ err }, 'webhook replay cron failed');
    return Response.json(
      { error: { code: 'internal_error', message: 'Cron run failed' } },
      { status: 500 },
    );
  }
}

export const GET = run;
export const POST = run;
