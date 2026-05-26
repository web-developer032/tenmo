import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Month-over-month deltas for the headline KPI strip on /admin.
 *
 * All deltas are percentage values rounded to 1dp; `null` means the
 * previous month had zero (no meaningful percentage).
 */

export type AdminMrrDeltas = {
  mrr_delta_pct: number | null;
  arr_delta_pct: number | null;
  paying_delta_pct: number | null;
  signups_delta_pct: number | null;
  current: { mrr_pence: number; paying_landlords: number; signups: number };
  previous: { mrr_pence: number; paying_landlords: number; signups: number };
};

function pctChange(curr: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export async function loadAdminMrrDeltas(sb: SupabaseClient): Promise<AdminMrrDeltas> {
  const { data } = await sb
    .from('mrr_snapshots')
    .select('month_start, mrr_pence, paying_landlords, signups')
    .order('month_start', { ascending: false })
    .limit(2);

  const rows = (data ?? []) as Array<{
    mrr_pence: number | null;
    paying_landlords: number | null;
    signups: number | null;
  }>;
  const current = {
    mrr_pence: Number(rows[0]?.mrr_pence ?? 0),
    paying_landlords: Number(rows[0]?.paying_landlords ?? 0),
    signups: Number(rows[0]?.signups ?? 0),
  };
  const previous = {
    mrr_pence: Number(rows[1]?.mrr_pence ?? 0),
    paying_landlords: Number(rows[1]?.paying_landlords ?? 0),
    signups: Number(rows[1]?.signups ?? 0),
  };

  return {
    mrr_delta_pct: pctChange(current.mrr_pence, previous.mrr_pence),
    arr_delta_pct: pctChange(current.mrr_pence * 12, previous.mrr_pence * 12),
    paying_delta_pct: pctChange(current.paying_landlords, previous.paying_landlords),
    signups_delta_pct: pctChange(current.signups, previous.signups),
    current,
    previous,
  };
}
