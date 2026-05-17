import type { NextRequest } from 'next/server';
import { collectDueRent } from '@/features/payments/server';
import { generateRentCharges } from '@/features/rent/server';
import { authenticateCron } from '@/lib/cron-auth';
import { getLogger } from '@/lib/logger';

/**
 * Daily rent-charge cron.
 *
 * Wired in `vercel.json` to run at 06:00 UTC. Two phases per run:
 *
 *   1. `generateRentCharges` — create rent_charges for any active
 *      tenancy whose next billing period falls within the horizon
 *      (default 7 days) and which doesn't already have a charge.
 *      Idempotent via the `(tenancy_id, period_start)` unique index.
 *
 *   2. `collectDueRent` — for every rent_charges row that's now due
 *      (or overdue) AND has an active GoCardless mandate AND has no
 *      in-flight DD payment row, kick off a one-off DD pull. Uses
 *      `Idempotency-Key: rent-charge-{chargeId}` so retries on the
 *      same charge always return the same GC payment.
 *
 * The DD pull is best-effort — if the GoCardless API is down or
 * rejects a single charge we still report success (the affected
 * details come back in the result body for diagnostics).
 *
 *   curl -X POST http://localhost:3000/api/cron/rent-charges
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
  const horizon = Number(url.searchParams.get('horizon_days') ?? '7');
  const skipCollection = url.searchParams.get('skip_collection') === 'true';

  const log = getLogger().child({ route: '/api/cron/rent-charges' });
  try {
    const charges = await generateRentCharges({
      horizonDays: Number.isFinite(horizon) && horizon >= 0 ? horizon : 7,
    });

    const collection = skipCollection ? null : await safelyCollectDueRent();

    return Response.json({ data: { charges, collection } });
  } catch (err) {
    log.error({ err }, 'rent charges cron failed');
    return Response.json(
      { error: { code: 'internal_error', message: 'Cron run failed' } },
      { status: 500 },
    );
  }
}

/** GoCardless not being configured (dev / preview) must NOT fail the
 * cron — charge generation succeeded, that's the critical step. */
async function safelyCollectDueRent() {
  const log = getLogger().child({ route: '/api/cron/rent-charges', step: 'collect' });
  try {
    return await collectDueRent({ horizonDays: 0 });
  } catch (err) {
    log.warn({ err }, 'collect-due-rent skipped (GC not configured?)');
    return { error: 'collection_skipped' };
  }
}

export const GET = run;
export const POST = run;
