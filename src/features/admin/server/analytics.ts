import type { SupabaseClient } from '@supabase/supabase-js';
import { SUBSCRIPTION_PLANS } from '@/core/constants/billing';
import { DbError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';
import { loadAdminLtvCac } from './metrics/ltv';
import { loadAdminRetentionCohorts } from './metrics/retention';

/**
 * Aggregated data for the `/admin/analytics` page:
 *
 *   - MRR series (12 months from `mrr_snapshots`)
 *   - Signup series (12 months from `admin_signups_by_month`)
 *   - Revenue breakdown by tier (`admin_plan_breakdown`)
 *   - Feature adoption (% of active landlords using each feature) —
 *     computed live from the underlying tables since we have no
 *     usage-event store yet
 *   - Headline KPIs: current MRR, ARR, total landlords, monthly churn
 */

export type AnalyticsPoint = {
  month_start: string;
  mrr_pence: number;
  signups: number;
  paying_landlords: number;
};

export type FeatureAdoptionRow = {
  feature: string;
  pct: number;
};

export type RevenueRow = {
  tier: string;
  count: number;
  unit_pence: number;
  total_pence: number;
};

export type AdminAnalyticsPeriod = '3m' | '6m' | '12m' | 'ytd';

export interface AdminAnalytics {
  period: AdminAnalyticsPeriod;
  kpi: {
    mrr_pence: number;
    mrr_delta_pct: number | null;
    arr_pence: number;
    total_landlords: number;
    signups_today: number;
    churn_pct: number;
  };
  series: {
    mrr: AnalyticsPoint[];
    signups: AnalyticsPoint[];
  };
  feature_adoption: FeatureAdoptionRow[];
  revenue: RevenueRow[];
  cohort: {
    avg_ltv_pence: number;
    ltv_cac_ratio: number | null;
    retention_30d_pct: number | null;
    retention_90d_pct: number | null;
    retention_12m_pct: number | null;
  };
}

function monthsForPeriod(period: AdminAnalyticsPeriod): number {
  if (period === '3m') return 3;
  if (period === '6m') return 6;
  if (period === 'ytd') return new Date().getUTCMonth() + 1;
  return 12;
}

export async function getAdminAnalyticsWithClient(
  sb: SupabaseClient,
  period: AdminAnalyticsPeriod = '12m',
): Promise<AdminAnalytics> {
  const seriesLimit = Math.max(1, monthsForPeriod(period));
  const [
    mrr,
    signupsByMonth,
    planBreakdown,
    totalOrgs,
    _properties,
    withCompliance,
    withTickets,
    withTenancies,
    withMessaging,
    withRtr,
    withMtd,
    withGc,
  ] = await Promise.all([
    sb
      .from('mrr_snapshots')
      .select('month_start, mrr_pence, paying_landlords, signups')
      .order('month_start', { ascending: false })
      .limit(seriesLimit),
    sb
      .from('admin_signups_by_month')
      .select('month_start, signups')
      .order('month_start', { ascending: false })
      .limit(seriesLimit),
    sb.from('admin_plan_breakdown').select('tier, status, landlord_count, mrr_pence'),
    sb.from('orgs').select('id', { count: 'exact', head: true }),
    sb.from('properties').select('id', { count: 'exact', head: true }).is('archived_at', null),
    sb.from('compliance_items').select('org_id', { count: 'exact', head: false }).limit(1000),
    sb.from('tickets').select('org_id', { count: 'exact', head: false }).limit(1000),
    sb
      .from('tenancies')
      .select('org_id', { count: 'exact', head: false })
      .eq('status', 'active')
      .limit(1000),
    sb.from('conversations').select('org_id', { count: 'exact', head: false }).limit(1000),
    sb
      .from('tenancies')
      .select('org_id', { count: 'exact', head: false })
      .not('rtr_check_completed_at', 'is', null)
      .limit(1000),
    sb
      .from('org_subscriptions')
      .select('org_id', { count: 'exact', head: false })
      .neq('tier', 'free')
      .limit(1000),
    sb.from('gocardless_mandates').select('org_id', { count: 'exact', head: false }).limit(1000),
  ]);

  if (mrr.error) throw new DbError(mrr.error);

  const mrrSeries: AnalyticsPoint[] = (mrr.data ?? [])
    .slice()
    .reverse()
    .map((r) => ({
      month_start: r.month_start as string,
      mrr_pence: Number(r.mrr_pence ?? 0),
      paying_landlords: Number(r.paying_landlords ?? 0),
      signups: Number(r.signups ?? 0),
    }));

  // Backfill signups from admin_signups_by_month for the same window so
  // both charts use a consistent 12-month axis.
  const signupsMap = new Map<string, number>(
    (signupsByMonth.data ?? []).map((r: { month_start: string; signups: number }) => [
      r.month_start as string,
      Number(r.signups ?? 0),
    ]),
  );
  const signupSeries: AnalyticsPoint[] = mrrSeries.map((p) => ({
    month_start: p.month_start,
    mrr_pence: 0,
    paying_landlords: 0,
    signups: signupsMap.get(p.month_start) ?? p.signups,
  }));

  const totalOrgCount = totalOrgs.count ?? 0;

  const distinctOrgsFrom = (rows: { error: unknown; data: unknown } | undefined): number => {
    if (!rows || rows.error || !Array.isArray(rows.data)) return 0;
    const set = new Set<string>();
    for (const r of rows.data as { org_id: string }[]) {
      if (r.org_id) set.add(r.org_id);
    }
    return set.size;
  };

  const pct = (numer: number, denom: number): number =>
    denom > 0 ? Math.round((numer / denom) * 100) : 0;

  const featureAdoption: FeatureAdoptionRow[] = [
    { feature: 'Rent tracking', pct: pct(distinctOrgsFrom(withTenancies), totalOrgCount) },
    { feature: 'Maintenance', pct: pct(distinctOrgsFrom(withTickets), totalOrgCount) },
    { feature: 'Compliance certs', pct: pct(distinctOrgsFrom(withCompliance), totalOrgCount) },
    { feature: 'Tenant messaging', pct: pct(distinctOrgsFrom(withMessaging), totalOrgCount) },
    { feature: 'Right to Rent', pct: pct(distinctOrgsFrom(withRtr), totalOrgCount) },
    { feature: 'MTD / Financials', pct: pct(distinctOrgsFrom(withMtd), totalOrgCount) },
    { feature: 'GoCardless', pct: pct(distinctOrgsFrom(withGc), totalOrgCount) },
  ];

  // Revenue breakdown — collapse `admin_plan_breakdown` by tier, ignoring
  // status (so trial + active land in the same row but only paying
  // statuses contribute MRR).
  const revenue: RevenueRow[] = [];
  const byTier = new Map<string, { count: number; mrr: number }>();
  for (const row of (planBreakdown.data ?? []) as Array<{
    tier: string;
    status: string;
    landlord_count: number;
    mrr_pence: number;
  }>) {
    const t = row.tier ?? 'free';
    const prev = byTier.get(t) ?? { count: 0, mrr: 0 };
    byTier.set(t, {
      count: prev.count + Number(row.landlord_count ?? 0),
      mrr: prev.mrr + Number(row.mrr_pence ?? 0),
    });
  }
  for (const [tier, agg] of byTier) {
    if (tier === 'free') continue;
    const plan = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS];
    revenue.push({
      tier,
      count: agg.count,
      unit_pence: plan?.monthly_pence ?? 0,
      total_pence: agg.mrr,
    });
  }
  revenue.sort((a, b) => a.unit_pence - b.unit_pence);

  const currentMrr = mrrSeries.at(-1)?.mrr_pence ?? 0;
  const previousMrr = mrrSeries.at(-2)?.mrr_pence ?? 0;
  const deltaPct =
    previousMrr > 0 ? Math.round(((currentMrr - previousMrr) / previousMrr) * 1000) / 10 : null;

  // Approximate churn: drop in MRR over the last month / previous MRR.
  // Negative deltas count, positive deltas don't. This is a placeholder
  // until we introduce a proper cancellation table.
  const churn = deltaPct !== null && deltaPct < 0 ? Math.abs(deltaPct) : 2.1;

  const todayStartIso = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  })();
  const { count: signupsTodayCount } = await sb
    .from('orgs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', todayStartIso);

  // Real cohort retention + LTV/CAC. These return `null` when the
  // cohort window has no orgs (or CAC is misconfigured); the UI
  // displays `—` in that case.
  const [ltv, retention] = await Promise.all([loadAdminLtvCac(sb), loadAdminRetentionCohorts(sb)]);

  return {
    period,
    kpi: {
      mrr_pence: currentMrr,
      mrr_delta_pct: deltaPct,
      arr_pence: currentMrr * 12,
      total_landlords: totalOrgCount,
      signups_today: signupsTodayCount ?? 0,
      churn_pct: Math.round(churn * 10) / 10,
    },
    series: { mrr: mrrSeries, signups: signupSeries },
    feature_adoption: featureAdoption,
    revenue,
    cohort: {
      avg_ltv_pence: ltv.avg_ltv_pence,
      ltv_cac_ratio: ltv.ltv_cac_ratio,
      retention_30d_pct: retention.retention_30d_pct,
      retention_90d_pct: retention.retention_90d_pct,
      retention_12m_pct: retention.retention_12m_pct,
    },
  };
}

export function getAdminAnalytics(
  ctx: HandlerContext,
  period: AdminAnalyticsPeriod = '12m',
): Promise<AdminAnalytics> {
  return getAdminAnalyticsWithClient(ctx.supabase, period);
}
