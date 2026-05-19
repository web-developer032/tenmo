import { CreditCard, TrendingDown, TrendingUp, UserPlus, Users } from 'lucide-react';
import { KpiCard } from '@/components/ds/kpi-card';
import { MiniStat, MiniStatList } from '@/components/ds/mini-stat';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SUBSCRIPTION_PLANS } from '@/core/constants/billing';
import { formatMoneyShort, formatMoneyWhole } from '@/core/utils/money';
import { AdminBarChart } from '@/features/admin/components/ds/admin-bar-chart';
import { AdminFeatureBar } from '@/features/admin/components/ds/admin-feature-bar';
import { loadAdminAnalytics } from '@/features/admin/loaders';

export const dynamic = 'force-dynamic';

/**
 * /admin/analytics — growth + revenue + retention dashboard.
 *
 * Lower-density than /admin: meant for monthly business reviews
 * rather than live ops. Uses the same MRR snapshot table as the
 * dashboard, plus the `admin_signups_by_month` view and live counts
 * for feature adoption.
 */
export default async function AdminAnalyticsPage() {
  const analytics = await loadAdminAnalytics();

  const mrrChart = analytics.series.mrr.map((p, idx) => ({
    label: monthShort(new Date(p.month_start)),
    value: p.mrr_pence,
    displayValue: formatMoneyShort(p.mrr_pence),
    highlight: idx === analytics.series.mrr.length - 1,
  }));

  const signupChart = analytics.series.signups.map((p, idx) => ({
    label: monthShort(new Date(p.month_start)),
    value: p.signups,
    displayValue: p.signups.toString(),
    highlight: idx === analytics.series.signups.length - 1,
  }));

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Analytics' }]}
        title="Analytics"
        description="Growth, revenue and retention metrics."
      />

      <ResponsiveGrid preset="kpi">
        <KpiCard
          accent="purple"
          label="MRR"
          value={formatMoneyWhole(analytics.kpi.mrr_pence)}
          icon={<CreditCard />}
          delta={
            analytics.kpi.mrr_delta_pct !== null
              ? {
                  value: `${analytics.kpi.mrr_delta_pct >= 0 ? '+' : ''}${analytics.kpi.mrr_delta_pct}%`,
                  tone: analytics.kpi.mrr_delta_pct >= 0 ? 'up' : 'down',
                }
              : undefined
          }
        />
        <KpiCard
          accent="purple"
          label="Annual run rate"
          value={formatMoneyShort(analytics.kpi.arr_pence)}
          icon={<TrendingUp />}
          delta={{ value: 'ARR', tone: 'info' }}
        />
        <KpiCard
          accent="forest"
          label="Total landlords"
          value={analytics.kpi.total_landlords.toLocaleString('en-GB')}
          icon={<Users />}
          delta={
            analytics.kpi.signups_today > 0
              ? { value: `+${analytics.kpi.signups_today} today`, tone: 'up' }
              : undefined
          }
        />
        <KpiCard
          accent="amber"
          label="Monthly churn"
          value={`${analytics.kpi.churn_pct}%`}
          icon={<TrendingDown />}
          delta={{ value: 'Watch', tone: 'warn' }}
        />
      </ResponsiveGrid>

      {/* MRR + signups charts */}
      <ResponsiveGrid preset="cards-2">
        <Card>
          <CardHeader>
            <CardTitle>MRR growth · 12 months</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminBarChart data={mrrChart} height={160} variant="forest" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>New landlord signups · 12 months</CardTitle>
            <span className="text-[12px] text-ink-light">
              <UserPlus className="mr-1 inline h-3.5 w-3.5" />
              {analytics.series.signups.reduce((acc, p) => acc + p.signups, 0)} total
            </span>
          </CardHeader>
          <CardContent>
            <AdminBarChart data={signupChart} height={160} variant="foam" />
          </CardContent>
        </Card>
      </ResponsiveGrid>

      {/* Feature adoption + revenue + retention */}
      <ResponsiveGrid preset="cards-2">
        <Card>
          <CardHeader>
            <CardTitle>Feature adoption</CardTitle>
            <p className="text-[12px] text-ink-light">
              % of active landlords using each Tenantly capability.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {analytics.feature_adoption.map((row) => (
              <AdminFeatureBar key={row.feature} label={row.feature} value={row.pct} />
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <MiniStatList>
                {analytics.revenue.length === 0 ? (
                  <p className="text-[13px] text-ink-light">No paying landlords yet.</p>
                ) : (
                  analytics.revenue.map((row) => (
                    <MiniStat
                      key={row.tier}
                      label={`${planLabel(row.tier)} (${row.count} × ${formatPenceShort(row.unit_pence)})`}
                      value={`${formatMoneyShort(row.total_pence)}/mo`}
                    />
                  ))
                )}
                <MiniStat
                  label="Total MRR"
                  value={
                    <span className="font-bold text-purple">
                      {formatMoneyWhole(analytics.kpi.mrr_pence)}/mo
                    </span>
                  }
                />
              </MiniStatList>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cohort retention</CardTitle>
            </CardHeader>
            <CardContent>
              <MiniStatList>
                <MiniStat
                  label="Avg LTV (landlord)"
                  value={
                    <span className="text-purple">
                      {formatMoneyShort(analytics.cohort.avg_ltv_pence)}
                    </span>
                  }
                />
                <MiniStat
                  label="LTV : CAC ratio"
                  value={
                    <span className="text-forest-700">
                      {analytics.cohort.ltv_cac_ratio.toFixed(1)}x
                    </span>
                  }
                />
                <MiniStat
                  label="30-day retention"
                  value={`${analytics.cohort.retention_30d_pct}%`}
                />
                <MiniStat
                  label="90-day retention"
                  value={`${analytics.cohort.retention_90d_pct}%`}
                />
                <MiniStat
                  label="12-month retention"
                  value={`${analytics.cohort.retention_12m_pct}%`}
                />
              </MiniStatList>
            </CardContent>
          </Card>
        </div>
      </ResponsiveGrid>
    </div>
  );
}

function monthShort(d: Date): string {
  return d.toLocaleString('en-GB', { month: 'short' });
}

function planLabel(tier: string): string {
  return SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS]?.name ?? tier;
}

function formatPenceShort(pence: number): string {
  return pence === 0 ? '—' : `£${pence / 100}`;
}
