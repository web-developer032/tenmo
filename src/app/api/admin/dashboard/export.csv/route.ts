import {
  assertAdmin,
  csvResponse,
  getDashboardStatsWithClient,
  loadAdminChurn,
  loadAdminMrrDeltas,
  loadAdminTicketResponseStats,
} from '@/features/admin/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/admin/dashboard/export.csv
 *
 * Returns the headline cuts shown on /admin as a single CSV — one
 * `metric, value` row per KPI plus a 12-month MRR series. Designed
 * for spreadsheet pivot work, not deep analytics; deeper data lives
 * on /admin/analytics.
 */
export const GET = handler(async (ctx) => {
  await assertAdmin(ctx);
  const [stats, deltas, churn, response] = await Promise.all([
    getDashboardStatsWithClient(ctx.supabase),
    loadAdminMrrDeltas(ctx.supabase),
    loadAdminChurn(ctx.supabase),
    loadAdminTicketResponseStats(ctx.supabase),
  ]);

  const rows: Array<{ metric: string; value: string }> = [
    { metric: 'MRR (current month)', value: penceLabel(stats.mrr.current_pence) },
    {
      metric: 'MRR delta vs previous month',
      value: deltas.mrr_delta_pct !== null ? `${deltas.mrr_delta_pct}%` : '—',
    },
    { metric: 'ARR', value: penceLabel(stats.mrr.arr_pence) },
    { metric: 'Active landlords', value: String(stats.counts.orgs) },
    { metric: 'Active tenants', value: String(stats.counts.active_tenancies) },
    { metric: 'Managed properties', value: String(stats.counts.properties) },
    { metric: 'New signups today', value: String(stats.counts.signups_today) },
    { metric: 'Open support tickets', value: String(stats.counts.support_open) },
    { metric: 'Compliance critical', value: String(stats.counts.compliance_critical) },
    {
      metric: 'Monthly churn',
      value: churn.pct !== null ? `${churn.pct}%` : '—',
    },
    {
      metric: 'Avg first response (min)',
      value: response.avg_minutes !== null ? String(response.avg_minutes) : '—',
    },
  ];

  for (const point of stats.series.mrr) {
    rows.push({
      metric: `MRR snapshot ${point.month_start.slice(0, 7)}`,
      value: penceLabel(point.mrr_pence),
    });
  }

  return csvResponse('tenantly-admin-dashboard', rows, [
    { header: 'Metric', value: (r) => r.metric },
    { header: 'Value', value: (r) => r.value },
  ]);
});

function penceLabel(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
}
