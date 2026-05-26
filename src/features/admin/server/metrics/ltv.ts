import type { SupabaseClient } from '@supabase/supabase-js';
import { getPlatformSettingsWithClient } from '../platform-settings';

/**
 * Lifetime value / customer acquisition cost ratio for /admin/analytics.
 *
 * LTV approximation: `ARPU × (1 / monthly_churn_rate)` where
 *   - ARPU = total MRR / paying_landlords (latest MRR snapshot)
 *   - monthly_churn_rate = max(canceled in last 30d / paying landlords, floor)
 *
 * CAC is admin-configurable via `platform_settings.assumed_cac_pence`
 * because we don't yet have real attribution. Default £40.
 *
 * Returns `null` for the ratio when CAC is zero (avoids divide-by-zero
 * + a misleading "infinity" figure).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_CHURN_RATE = 0.005; // 0.5%/month floor so LTV doesn't run away

export type AdminLtvCac = {
  arpu_pence: number;
  avg_ltv_pence: number;
  cac_pence: number;
  ltv_cac_ratio: number | null;
  monthly_churn_pct: number;
};

export async function loadAdminLtvCac(sb: SupabaseClient): Promise<AdminLtvCac> {
  const settings = await getPlatformSettingsWithClient(sb);
  const cacPence = settings.assumed_cac_pence ?? 4000;

  // Pull the most recent MRR snapshot for ARPU.
  const { data: snapRows } = await sb
    .from('mrr_snapshots')
    .select('mrr_pence, paying_landlords')
    .order('month_start', { ascending: false })
    .limit(1);
  const latest = (snapRows?.[0] ?? null) as {
    mrr_pence: number | null;
    paying_landlords: number | null;
  } | null;
  const mrr = Number(latest?.mrr_pence ?? 0);
  const paying = Number(latest?.paying_landlords ?? 0);
  const arpu = paying > 0 ? Math.round(mrr / paying) : 0;

  // Monthly churn: orgs canceled in the last 30 days vs paying base.
  const sinceIso = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const [{ count: canceledLast30 }, { count: payingNow }] = await Promise.all([
    sb
      .from('org_subscriptions')
      .select('org_id', { count: 'exact', head: true })
      .eq('status', 'canceled')
      .gte('canceled_at', sinceIso),
    sb
      .from('org_subscriptions')
      .select('org_id', { count: 'exact', head: true })
      .in('status', ['active', 'trialing', 'past_due']),
  ]);
  const churnRate =
    (payingNow ?? 0) > 0
      ? Math.max((canceledLast30 ?? 0) / (payingNow ?? 1), MIN_CHURN_RATE)
      : MIN_CHURN_RATE;

  const ltv = churnRate > 0 ? Math.round(arpu / churnRate) : 0;
  const ratio = cacPence > 0 ? Math.round((ltv / cacPence) * 10) / 10 : null;

  return {
    arpu_pence: arpu,
    avg_ltv_pence: ltv,
    cac_pence: cacPence,
    ltv_cac_ratio: ratio,
    monthly_churn_pct: Math.round(churnRate * 1000) / 10,
  };
}
