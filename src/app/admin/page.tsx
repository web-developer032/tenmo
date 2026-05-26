import {
  Building2,
  Clock,
  CreditCard,
  LifeBuoy,
  LineChart,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { AvRow } from '@/components/ds/av-row';
import { KpiCard } from '@/components/ds/kpi-card';
import { MiniStat, MiniStatList } from '@/components/ds/mini-stat';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SUBSCRIPTION_PLANS } from '@/core/constants/billing';
import { formatMoneyShort, formatMoneyWhole } from '@/core/utils/money';
import { DashboardMonthPicker } from '@/features/admin/components/dashboard-month-picker';
import { AdminBarChart } from '@/features/admin/components/ds';
import { AdminPlatformHealth } from '@/features/admin/components/ds/admin-platform-health';
import { ExportCsvLink } from '@/features/admin/components/export-csv-link';
import { loadAdminDashboardStats } from '@/features/admin/loaders';
import type { OpenTicketRow, RecentSignupRow } from '@/features/admin/server/dashboard-stats';
import {
  loadAdminChurn,
  loadAdminMrrDeltas,
  loadAdminTicketResponseStats,
  loadPlatformHealthProbes,
} from '@/features/admin/server/metrics';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    month?: string;
  }>;
}

/**
 * /admin — Platform Dashboard.
 *
 * Matches the HMOeez reference: two KPI rows (5-up + 4-up) backed by
 * real MRR snapshots + churn / response-time / health probes, an MRR
 * chart paired with plan breakdown + platform health, then a bottom
 * row with recent signups and the open ticket queue.
 */
export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const sb = await createClient();
  const [stats, deltas, churn, response, healthProbes] = await Promise.all([
    loadAdminDashboardStats(),
    loadAdminMrrDeltas(sb),
    loadAdminChurn(sb),
    loadAdminTicketResponseStats(sb),
    loadPlatformHealthProbes(),
  ]);

  const monthLabels = stats.series.mrr.map((p) => monthLetter(new Date(p.month_start)));
  const mrrChart = stats.series.mrr.map((p, idx) => ({
    label: monthLabels[idx] ?? '',
    value: p.mrr_pence,
    displayValue: formatMoneyShort(p.mrr_pence),
    highlight: idx === stats.series.mrr.length - 1,
  }));

  const previousEntry = stats.series.mrr.at(-2);
  const previousLabel = previousEntry
    ? monthLetter(new Date(previousEntry.month_start))
    : 'last month';

  const monthOptions = buildMonthOptions(stats.series.mrr.map((p) => p.month_start));
  const currentMonth = sp.month ?? monthOptions[0]?.value ?? '';

  const overallHealth = computeOverallHealth(healthProbes);

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Dashboard' }]}
        title="Platform Dashboard"
        description="Live overview · last updated just now"
        actions={
          <>
            <DashboardMonthPicker months={monthOptions} current={currentMonth} />
            <ExportCsvLink href="/api/admin/dashboard/export.csv" label="Export report" />
            <Link
              href="/admin/analytics"
              className="inline-flex items-center gap-1.5 rounded-button border border-border-soft bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-mid transition-colors hover:bg-foam hover:text-forest-700"
            >
              <LineChart className="h-3.5 w-3.5" /> Full analytics
            </Link>
          </>
        }
      />

      {/* KPI row 1 — 5 up */}
      <ResponsiveGrid preset="kpi-5">
        <KpiCard
          accent="purple"
          label={`MRR (${monthLong(new Date())})`}
          value={formatMoneyWhole(stats.mrr.current_pence)}
          icon={<CreditCard />}
          delta={deltaPill(deltas.mrr_delta_pct, 'percent')}
        />
        <KpiCard
          accent="forest"
          label="Active landlords"
          value={stats.counts.orgs.toLocaleString('en-GB')}
          icon={<Building2 />}
          delta={deltaPill(deltas.paying_delta_pct, 'percent')}
        />
        <KpiCard
          accent="forest"
          label="Active tenants"
          value={stats.counts.active_tenancies.toLocaleString('en-GB')}
          icon={<Users />}
        />
        <KpiCard
          accent="amber"
          label="Monthly churn"
          value={churn.pct !== null ? `${churn.pct}%` : '—'}
          icon={<TrendingDown />}
          delta={churn.pct !== null && churn.pct > 5 ? { value: 'Watch', tone: 'warn' } : undefined}
          sublabel={
            churn.canceled_count > 0
              ? `${churn.canceled_count} cancellations in 30 days`
              : undefined
          }
        />
        <KpiCard
          accent="red"
          label="Open support tickets"
          value={stats.counts.support_open.toLocaleString('en-GB')}
          icon={<LifeBuoy />}
          delta={stats.counts.support_open > 0 ? { value: 'Open', tone: 'down' } : undefined}
        />
      </ResponsiveGrid>

      {/* KPI row 2 — 4 up */}
      <ResponsiveGrid preset="kpi">
        <KpiCard
          accent="forest"
          label="Managed properties"
          value={stats.counts.properties.toLocaleString('en-GB')}
          icon={<Building2 />}
        />
        <KpiCard
          accent="purple"
          label="Annual run rate"
          value={formatMoneyShort(stats.mrr.arr_pence)}
          icon={<TrendingUp />}
          delta={deltaPill(deltas.arr_delta_pct, 'percent') ?? { value: 'ARR', tone: 'info' }}
        />
        <KpiCard
          accent="forest"
          label="New signups today"
          value={stats.counts.signups_today.toLocaleString('en-GB')}
          icon={<UserPlus />}
          delta={{ value: 'Today', tone: 'info' }}
        />
        <KpiCard
          accent="blue"
          label="Avg support response"
          value={formatResponse(response.avg_minutes)}
          icon={<Clock />}
          delta={{ value: 'Avg', tone: 'info' }}
          sublabel={response.pending > 0 ? `${response.pending} awaiting first reply` : undefined}
        />
      </ResponsiveGrid>

      {/* MRR chart + plan breakdown + platform health */}
      <ResponsiveGrid preset="dash-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>MRR — last 12 months</CardTitle>
              <p className="mt-1 text-[12px] text-ink-light">
                Snapshots captured monthly. Latest column is the live total.
              </p>
            </div>
            <Link
              href="/admin/analytics"
              className="text-[12px] font-semibold text-forest-600 hover:underline"
            >
              Full analytics →
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="font-sans text-[26px] font-extrabold leading-none tracking-tight text-ink">
                  {formatMoneyWhole(stats.mrr.current_pence)}
                </div>
                <p className="mt-1 text-[12px] text-ink-light">
                  {monthLong(new Date())} ·{' '}
                  {deltas.mrr_delta_pct !== null ? (
                    <span
                      className={
                        deltas.mrr_delta_pct >= 0
                          ? 'font-semibold text-forest-600'
                          : 'font-semibold text-alert'
                      }
                    >
                      {deltas.mrr_delta_pct >= 0 ? '↑' : '↓'} {Math.abs(deltas.mrr_delta_pct)}% vs{' '}
                      {previousLabel}
                    </span>
                  ) : (
                    <span className="text-ink-light">No prior comparison</span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <div className="text-[12px] text-ink-light">ARR</div>
                <div className="font-sans text-[18px] font-bold text-purple">
                  {formatMoneyShort(stats.mrr.arr_pence)}
                </div>
              </div>
            </div>
            <AdminBarChart data={mrrChart} height={140} variant="forest" />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Plan breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <MiniStatList>
                {stats.plan_breakdown.length === 0 ? (
                  <p className="text-[13px] text-ink-light">No paying landlords yet.</p>
                ) : (
                  stats.plan_breakdown.map((row) => (
                    <MiniStat
                      key={`${row.tier}-${row.status}`}
                      label={tierLabel(row.tier, row.status)}
                      value={`${row.landlord_count} landlord${row.landlord_count === 1 ? '' : 's'}`}
                    />
                  ))
                )}
              </MiniStatList>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Platform health</CardTitle>
              <Badge variant={overallHealth.variant}>{overallHealth.label}</Badge>
            </CardHeader>
            <CardContent>
              <AdminPlatformHealth
                services={healthProbes.map((p) => ({
                  name: p.name,
                  status: p.status,
                  detail: p.detail,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </ResponsiveGrid>

      {/* Recent signups + open tickets */}
      <ResponsiveGrid preset="dash-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <CardTitle>Recent signups</CardTitle>
            <Link
              href="/admin/orgs"
              className="text-[12px] font-semibold text-forest-600 hover:underline"
            >
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            <RecentSignupsTable rows={stats.recent_signups} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <CardTitle>Open support tickets</CardTitle>
            <Link
              href="/admin/support"
              className="text-[12px] font-semibold text-forest-600 hover:underline"
            >
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            <OpenTicketsTable rows={stats.open_tickets} />
          </CardContent>
        </Card>
      </ResponsiveGrid>
    </div>
  );
}

function RecentSignupsTable({ rows }: { rows: RecentSignupRow[] }) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-ink-light">No landlords have signed up yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="border-b border-border-soft text-left text-[11px] font-bold uppercase tracking-wider text-ink-light">
          <tr>
            <th className="px-2 py-2 font-bold">Landlord</th>
            <th className="px-2 py-2 font-bold">Plan</th>
            <th className="hidden px-2 py-2 font-bold sm:table-cell">Properties</th>
            <th className="px-2 py-2 font-bold">Joined</th>
            <th className="px-2 py-2 font-bold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.org_id} className="border-b border-border-soft last:border-b-0">
              <td className="px-2 py-3">
                <AvRow size="sm" name={r.owner_name ?? r.org_name} sub={r.org_name} />
              </td>
              <td className="px-2 py-3">
                <TierPill tier={r.tier} />
              </td>
              <td className="hidden px-2 py-3 sm:table-cell">{r.property_count}</td>
              <td className="px-2 py-3 text-[12px] text-ink-light">{relativeTime(r.created_at)}</td>
              <td className="px-2 py-3">
                <StatusPill status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpenTicketsTable({ rows }: { rows: OpenTicketRow[] }) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-ink-light">No open support tickets — nice work.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="border-b border-border-soft text-left text-[11px] font-bold uppercase tracking-wider text-ink-light">
          <tr>
            <th className="px-2 py-2 font-bold">Ticket</th>
            <th className="px-2 py-2 font-bold">From</th>
            <th className="px-2 py-2 font-bold">Priority</th>
            <th className="px-2 py-2 font-bold">Age</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-border-soft last:border-b-0">
              <td className="px-2 py-3">
                <div className="font-semibold text-ink">{t.title}</div>
                <div className="text-[11px] text-ink-light">{categoryLabel(t.category)}</div>
              </td>
              <td className="px-2 py-3 text-[12px] text-ink-mid">
                {t.reporter_name
                  ?.split(/\s+/)
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() ?? '—'}
              </td>
              <td className="px-2 py-3">
                <PriorityPill priority={t.priority} />
              </td>
              <td className="px-2 py-3 text-[12px] text-ink-light">{relativeTime(t.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TierPill({ tier }: { tier: string | null }) {
  if (!tier) return <Badge variant="neutral">Free</Badge>;
  const label = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS]?.name ?? tier;
  const variant =
    tier === 'portfolio'
      ? 'purple'
      : tier === 'pro'
        ? 'success'
        : tier === 'starter'
          ? 'neutral'
          : 'outline';
  return <Badge variant={variant as 'purple'}>{label}</Badge>;
}

function StatusPill({ status }: { status: string | null }) {
  if (!status) return null;
  if (status === 'active') return <Badge variant="active">Active</Badge>;
  if (status === 'trialing') return <Badge variant="warning">Trial</Badge>;
  if (status === 'past_due' || status === 'unpaid') return <Badge variant="overdue">Failed</Badge>;
  if (status === 'canceled') return <Badge variant="neutral">Cancelled</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

function PriorityPill({ priority }: { priority: 'low' | 'med' | 'high' }) {
  if (priority === 'high') return <Badge variant="urgent">High</Badge>;
  if (priority === 'med') return <Badge variant="warning">Med</Badge>;
  return <Badge variant="neutral">Low</Badge>;
}

function tierLabel(tier: string, status: string): string {
  if (status === 'trialing') return 'Trial (14d)';
  const plan = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS];
  if (!plan) return tier;
  if (plan.monthly_pence === 0) return 'Free · self-serve';
  return `${plan.name} · £${plan.monthly_pence / 100}/mo`;
}

function categoryLabel(category: string): string {
  if (category === 'bug') return 'Bug report';
  if (category === 'integration') return 'Integration';
  if (category === 'email') return 'Email delivery';
  if (category === 'reports') return 'Reports';
  if (category === 'billing') return 'Billing';
  return 'Other';
}

function monthLetter(d: Date): string {
  return d.toLocaleString('en-GB', { month: 'short' }).slice(0, 1);
}

function monthLong(d: Date): string {
  return d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

function deltaPill(
  value: number | null,
  unit: 'percent' | 'absolute',
): { value: string; tone: 'up' | 'down' } | undefined {
  if (value === null) return undefined;
  if (value === 0) return undefined;
  const arrow = value >= 0 ? '↑' : '↓';
  const suffix = unit === 'percent' ? '%' : '';
  return {
    value: `${arrow} ${Math.abs(value)}${suffix}`,
    tone: value >= 0 ? 'up' : 'down',
  };
}

function formatResponse(avgMinutes: number | null): string {
  if (avgMinutes === null) return '—';
  if (avgMinutes < 60) return `${avgMinutes}m`;
  const hours = Math.floor(avgMinutes / 60);
  const mins = avgMinutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

function buildMonthOptions(snapshotMonths: string[]): { value: string; label: string }[] {
  const seen = new Set<string>();
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { month: 'short', year: 'numeric' });
  };
  const sorted = [...snapshotMonths].sort((a, b) => b.localeCompare(a));
  const options: { value: string; label: string }[] = [];
  for (const iso of sorted) {
    const key = iso.slice(0, 7);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ value: key, label: fmt(iso) });
  }
  if (options.length === 0) {
    const now = new Date();
    options.push({ value: now.toISOString().slice(0, 7), label: fmt(now.toISOString()) });
  }
  return options;
}

function computeOverallHealth(
  probes: Array<{ status: 'operational' | 'degraded' | 'outage' | 'unknown' }>,
): { label: string; variant: 'success' | 'warning' | 'urgent' | 'neutral' } {
  if (probes.length === 0) return { label: 'No probes', variant: 'neutral' };
  if (probes.some((p) => p.status === 'outage')) {
    return { label: 'Outage', variant: 'urgent' };
  }
  if (probes.some((p) => p.status === 'degraded')) {
    return { label: 'Degraded', variant: 'warning' };
  }
  if (probes.every((p) => p.status === 'unknown')) {
    return { label: 'Unknown', variant: 'neutral' };
  }
  return { label: 'All systems ok', variant: 'success' };
}
