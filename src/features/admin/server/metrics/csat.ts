import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * CSAT score for the platform support team.
 *
 * Definition: `% of rated tickets in the window whose rating is >= 4`,
 * computed from `platform_support_tickets.csat_rating` rows where the
 * column is non-null. The CSAT widget on /admin/support shows `—`
 * whenever fewer than `MIN_SAMPLE` ratings exist, so the KPI is honest
 * with a small dataset.
 *
 * The window is the last 30 days by default; if that returns fewer
 * than the minimum sample size we widen to 90 days so an underused
 * support queue still has something to show in dev / staging.
 */

const MIN_SAMPLE = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AdminCsat = {
  csat_pct: number | null;
  sample_size: number;
  window_days: 30 | 90;
};

async function fetchRatingsSince(sb: SupabaseClient, sinceIso: string): Promise<number[]> {
  const { data, error } = await sb
    .from('platform_support_tickets')
    .select('csat_rating, csat_submitted_at')
    .not('csat_rating', 'is', null)
    .gte('csat_submitted_at', sinceIso);
  if (error || !Array.isArray(data)) return [];
  return (data as Array<{ csat_rating: number | null }>)
    .map((r) => Number(r.csat_rating))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
}

export async function loadAdminCsat(sb: SupabaseClient): Promise<AdminCsat> {
  const now = Date.now();
  const thirty = new Date(now - 30 * DAY_MS).toISOString();
  const ninety = new Date(now - 90 * DAY_MS).toISOString();

  let ratings = await fetchRatingsSince(sb, thirty);
  let windowDays: 30 | 90 = 30;
  if (ratings.length < MIN_SAMPLE) {
    ratings = await fetchRatingsSince(sb, ninety);
    windowDays = 90;
  }

  if (ratings.length === 0) {
    return { csat_pct: null, sample_size: 0, window_days: windowDays };
  }

  const happy = ratings.filter((r) => r >= 4).length;
  const csat_pct = Math.round((happy / ratings.length) * 1000) / 10;

  return { csat_pct, sample_size: ratings.length, window_days: windowDays };
}
