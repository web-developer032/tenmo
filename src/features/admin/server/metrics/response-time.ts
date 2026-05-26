import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Average + median (p50) response time for platform support tickets,
 * measured as `first_responded_at - created_at`. Drives the "Avg
 * first response" KPI on /admin/support.
 *
 * Only tickets created in the last 30 days are considered; un-
 * responded tickets are excluded from the computation but counted in
 * `pending`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type AdminTicketResponseStats = {
  avg_minutes: number | null;
  p50_minutes: number | null;
  sample_size: number;
  pending: number;
};

export async function loadAdminTicketResponseStats(
  sb: SupabaseClient,
): Promise<AdminTicketResponseStats> {
  const sinceIso = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const { data, error } = await sb
    .from('platform_support_tickets')
    .select('created_at, first_responded_at')
    .gte('created_at', sinceIso);
  if (error || !Array.isArray(data)) {
    return { avg_minutes: null, p50_minutes: null, sample_size: 0, pending: 0 };
  }

  const responded: number[] = [];
  let pending = 0;
  for (const row of data as Array<{
    created_at: string | null;
    first_responded_at: string | null;
  }>) {
    if (!row.created_at) continue;
    if (!row.first_responded_at) {
      pending += 1;
      continue;
    }
    const t0 = new Date(row.created_at).getTime();
    const t1 = new Date(row.first_responded_at).getTime();
    if (Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0) {
      responded.push((t1 - t0) / 60_000);
    }
  }

  if (responded.length === 0) {
    return { avg_minutes: null, p50_minutes: null, sample_size: 0, pending };
  }

  const avg = responded.reduce((sum, m) => sum + m, 0) / responded.length;
  const sorted = [...responded].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length / 2)] ?? avg;

  return {
    avg_minutes: Math.round(avg),
    p50_minutes: Math.round(p50),
    sample_size: responded.length,
    pending,
  };
}
