import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Approximate monthly churn rate for the headline KPI strip.
 *
 *   churn = (paid subscriptions canceled in the last 30 days)
 *           / (paying landlords at the start of the period)
 *
 * Returns a percentage (one decimal place) or `null` when the
 * denominator is zero so the UI can render `—` rather than `0.0%`,
 * which would be misleading.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type AdminChurn = {
  pct: number | null;
  canceled_count: number;
  baseline_count: number;
};

export async function loadAdminChurn(sb: SupabaseClient): Promise<AdminChurn> {
  const sinceIso = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const [canceled, baseline] = await Promise.all([
    sb
      .from('org_subscriptions')
      .select('org_id', { count: 'exact', head: true })
      .eq('status', 'canceled')
      .gte('canceled_at', sinceIso),
    sb
      .from('org_subscriptions')
      .select('org_id', { count: 'exact', head: true })
      .neq('tier', 'free'),
  ]);

  const canceledCount = canceled.count ?? 0;
  const baselineCount = baseline.count ?? 0;
  if (baselineCount === 0) {
    return { pct: null, canceled_count: canceledCount, baseline_count: 0 };
  }
  const pct = Math.round((canceledCount / baselineCount) * 1000) / 10;
  return { pct, canceled_count: canceledCount, baseline_count: baselineCount };
}
