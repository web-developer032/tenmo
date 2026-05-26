import 'server-only';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Snapshot the current month's MRR / signup state into `mrr_snapshots`.
 *
 * Runs on a monthly cron (`/api/cron/mrr-snapshot`) — idempotent by
 * `month_start` so re-running mid-month just updates today's row.
 *
 * Calculations (all derived from existing rows, never an external API):
 *   * `mrr_pence` — sum of `org_subscriptions.mrr_pence` where status in
 *     {`active`, `trialing`, `past_due`}. We include `past_due` because
 *     the design treats them as "still on the platform, just late".
 *   * `paying_landlords` — count of distinct org_subscriptions with
 *     `tier <> 'free'` AND status in {`active`, `past_due`, `trialing`}.
 *   * `signups` — orgs.created_at in the current month so far.
 *   * `churned` — org_subscriptions.canceled_at in the current month.
 *
 * The cron also backfills any missing `mrr_snapshots` rows for the
 * previous 11 months so a fresh deployment immediately has a populated
 * 12-month chart. Backfill values for past months use the same query
 * shape but bounded to that month's window.
 */

const log = () => getLogger().child({ module: 'billing.mrr-snapshot' });

export type MrrSnapshot = {
  month_start: string;
  mrr_pence: number;
  paying_landlords: number;
  signups: number;
  churned: number;
};

function monthStart(date: Date): string {
  const y = date.getUTCFullYear();
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}-01`;
}

function nextMonthStart(date: Date): string {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return monthStart(next);
}

async function computeSnapshotFor(target: Date): Promise<MrrSnapshot> {
  const sb = createServiceClient();
  const startIso = `${monthStart(target)}T00:00:00.000Z`;
  const endIso = `${nextMonthStart(target)}T00:00:00.000Z`;

  const [{ data: subs }, { count: signupsCount }, { count: churnedCount }] = await Promise.all([
    sb
      .from('org_subscriptions')
      .select('mrr_pence, tier, status')
      .in('status', ['active', 'trialing', 'past_due']),
    sb
      .from('orgs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    sb
      .from('org_subscriptions')
      .select('org_id', { count: 'exact', head: true })
      .gte('canceled_at', startIso)
      .lt('canceled_at', endIso),
  ]);

  let mrrPence = 0;
  let payingLandlords = 0;
  for (const s of subs ?? []) {
    const mrr = Number(s.mrr_pence ?? 0);
    mrrPence += mrr;
    if (s.tier && s.tier !== 'free') payingLandlords += 1;
  }

  return {
    month_start: monthStart(target),
    mrr_pence: mrrPence,
    paying_landlords: payingLandlords,
    signups: signupsCount ?? 0,
    churned: churnedCount ?? 0,
  };
}

export async function snapshotCurrentMonthMrr(): Promise<MrrSnapshot> {
  const snapshot = await computeSnapshotFor(new Date());
  const sb = createServiceClient();
  const { error } = await sb.from('mrr_snapshots').upsert(snapshot, {
    onConflict: 'month_start',
  });
  if (error) {
    log().error({ err: error, month: snapshot.month_start }, 'failed to upsert mrr_snapshot');
    throw error;
  }
  log().info({ snapshot }, 'mrr snapshot upserted');
  return snapshot;
}

/**
 * Backfill rows for the trailing 12 months when a recent reset leaves
 * the `mrr_snapshots` table thin. Existing rows are left untouched.
 */
export async function backfillTrailingMonths(months = 12): Promise<MrrSnapshot[]> {
  const out: MrrSnapshot[] = [];
  for (let i = 0; i < months; i += 1) {
    const ref = new Date();
    ref.setUTCMonth(ref.getUTCMonth() - i);
    const snap = await computeSnapshotFor(ref);
    const sb = createServiceClient();
    const { error } = await sb
      .from('mrr_snapshots')
      .upsert(snap, { onConflict: 'month_start', ignoreDuplicates: false });
    if (error) {
      log().warn({ err: error, month: snap.month_start }, 'backfill upsert failed; continuing');
    } else {
      out.push(snap);
    }
  }
  return out;
}
