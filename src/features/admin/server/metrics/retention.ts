import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Retention cohorts for /admin/analytics.
 *
 * For each window N in [30, 90, 365] days we compute
 *   `count(orgs created N..now-N days ago whose subscription is not canceled)`
 *   `count(orgs created N..now-N days ago)`
 * → retention percentage.
 *
 * A simple cohort definition that uses the existing
 * `org_subscriptions.status` column. Once we have a proper
 * cancellation event log we can swap this for cohort survival curves.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type AdminRetentionCohorts = {
  retention_30d_pct: number | null;
  retention_90d_pct: number | null;
  retention_12m_pct: number | null;
};

async function countCohort(
  sb: SupabaseClient,
  bandStartIso: string,
  bandEndIso: string,
): Promise<{ total: number; surviving: number }> {
  const [total, surviving] = await Promise.all([
    sb
      .from('orgs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', bandStartIso)
      .lt('created_at', bandEndIso),
    sb
      .from('orgs')
      .select('id, org_subscriptions!inner(status)', { count: 'exact', head: true })
      .gte('created_at', bandStartIso)
      .lt('created_at', bandEndIso)
      .neq('org_subscriptions.status', 'canceled')
      .is('deleted_at', null),
  ]);
  return {
    total: total.count ?? 0,
    surviving: surviving.count ?? 0,
  };
}

function pct(numer: number, denom: number): number | null {
  if (denom === 0) return null;
  return Math.round((numer / denom) * 1000) / 10;
}

export async function loadAdminRetentionCohorts(
  sb: SupabaseClient,
  now: Date = new Date(),
): Promise<AdminRetentionCohorts> {
  const t = now.getTime();
  const iso = (ms: number) => new Date(ms).toISOString();

  // 30d cohort: orgs created 31..60 days ago (gives them >= 30 days to live)
  const c30 = await countCohort(sb, iso(t - 60 * DAY_MS), iso(t - 30 * DAY_MS));
  // 90d cohort: orgs created 91..120 days ago
  const c90 = await countCohort(sb, iso(t - 120 * DAY_MS), iso(t - 90 * DAY_MS));
  // 12m cohort: orgs created 365..425 days ago
  const c365 = await countCohort(sb, iso(t - 425 * DAY_MS), iso(t - 365 * DAY_MS));

  return {
    retention_30d_pct: pct(c30.surviving, c30.total),
    retention_90d_pct: pct(c90.surviving, c90.total),
    retention_12m_pct: pct(c365.surviving, c365.total),
  };
}
