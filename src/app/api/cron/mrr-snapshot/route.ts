import type { NextRequest } from 'next/server';
import { backfillTrailingMonths, snapshotCurrentMonthMrr } from '@/features/billing/server';
import { authenticateCron } from '@/lib/cron-auth';
import { getLogger } from '@/lib/logger';

/**
 * Monthly MRR snapshot cron — writes one row per month to `mrr_snapshots`.
 *
 * Schedule (configured in `vercel.json`): first day of the month at 02:00 UTC.
 * Re-running mid-month is safe — the snapshot is upserted by `month_start`.
 *
 * Behaviour:
 *   - Always upserts the current month's snapshot.
 *   - Optional query `?backfill=12` (capped to 24) backfills the previous N
 *     months. Useful right after `db:reset` to populate the 12-month chart.
 *
 *   curl -X POST http://localhost:3000/api/cron/mrr-snapshot?backfill=12
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

  const url = new URL(req.url);
  const log = getLogger().child({ route: '/api/cron/mrr-snapshot' });
  try {
    const current = await snapshotCurrentMonthMrr();
    const backfillCount = Math.min(24, Math.max(0, Number(url.searchParams.get('backfill') ?? '0')));
    const backfilled = backfillCount > 0 ? await backfillTrailingMonths(backfillCount) : [];
    log.info(
      { current_month: current.month_start, backfilled: backfilled.length },
      'mrr snapshot cron complete',
    );
    return Response.json({ data: { current, backfilled } });
  } catch (err) {
    log.error({ err }, 'mrr snapshot cron failed');
    return Response.json(
      { error: { code: 'internal_error', message: 'Cron run failed' } },
      { status: 500 },
    );
  }
}

export const GET = run;
export const POST = run;
