import { AlertCircle, ArrowUp, CreditCard, TrendingUp, Users } from 'lucide-react';
import { redirect } from 'next/navigation';
import { AvRow } from '@/components/ds/av-row';
import { KpiCard } from '@/components/ds/kpi-card';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SUBSCRIPTION_PLANS } from '@/core/constants/billing';
import { AdminListQuery } from '@/core/schemas/admin';
import { formatMoneyWhole } from '@/core/utils/money';
import { AdminPagination } from '@/features/admin/components/admin-pagination';
import { AdminSearchInput } from '@/features/admin/components/admin-search-input';
import { BillingRowActions } from '@/features/admin/components/billing-row-actions';
import { AdminBanner, AdminFilterRow } from '@/features/admin/components/ds';
import { FilterSelect } from '@/features/admin/components/filter-select';
import { getAdminSelf, hasAdminRole } from '@/features/admin/server';
import { listOrgSummaryWithClient } from '@/features/admin/server/list-org-summary';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    q?: string;
    tier?: string;
    status?: string;
    sort?: string;
    page?: string;
    per_page?: string;
  }>;
}

/**
 * /admin/billing — Subscriptions & Billing.
 *
 * Aggregates the same `admin_org_summary` view as Landlords but
 * focuses on billing fields: MRR, payment method, failure status,
 * next billing date. Action column is gated behind `finance` /
 * `super`; other roles see a read-only "View" link.
 */
export default async function AdminBillingPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin/billing');

  const self = await getAdminSelf(supabase, user.id);
  const canEdit = hasAdminRole(self, ['super', 'finance']);

  const sp = await searchParams;
  const params = AdminListQuery.parse({
    q: sp.q,
    page: sp.page,
    per_page: sp.per_page,
  });
  const tier = sp.tier ?? 'all';
  const status = sp.status ?? 'all';
  const sort = (sp.sort as 'newest' | 'mrr' | 'properties' | 'name') ?? 'mrr';

  const result = await listOrgSummaryWithClient(supabase, {
    q: params.q ?? null,
    tier: tier === 'all' ? null : tier,
    status: status === 'all' ? null : status,
    sort,
    page: params.page,
    perPage: params.per_page,
  });

  // KPI calculations — also include a full-platform aggregate so the
  // numbers don't shift when filters are applied. We're already
  // hitting the view; one more query for totals is fine.
  const totals = await getBillingTotals(supabase);

  const failuresInView = result.rows.filter(
    (r) => r.last_payment_status === 'failed' || r.status === 'past_due' || r.status === 'unpaid',
  );

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Subscriptions & Billing' }]}
        title="Subscriptions & Billing"
        description="Stripe-powered · all amounts in GBP."
        actions={
          <Button size="sm" variant="ghost" disabled>
            Export billing report
          </Button>
        }
      />

      {totals.failed_count > 0 ? (
        <AdminBanner
          tone="alert"
          title={`${totals.failed_count} payment failure${totals.failed_count === 1 ? '' : 's'} — action required`}
          description="Stripe will retry automatically — manual outreach recommended after 3 failures."
        />
      ) : null}

      <ResponsiveGrid preset="kpi-5">
        <KpiCard
          accent="purple"
          icon={<CreditCard />}
          label="MRR"
          value={formatMoneyWhole(totals.mrr_pence)}
          delta={{ value: '↑ 12%', tone: 'up' }}
        />
        <KpiCard
          accent="forest"
          icon={<Users />}
          label="Paying landlords"
          value={totals.paying_landlords.toString()}
          delta={{ value: '98.2%', tone: 'info' }}
        />
        <KpiCard
          accent="amber"
          icon={<AlertCircle />}
          label="Failed payments"
          value={totals.failed_count.toString()}
          delta={totals.failed_count > 0 ? { value: 'Action', tone: 'warn' } : undefined}
        />
        <KpiCard
          accent="amber"
          icon={<ArrowUp />}
          label="Churn rate"
          value={`${totals.churn_pct.toFixed(1)}%`}
          delta={{ value: 'Watch', tone: 'warn' }}
        />
        <KpiCard
          accent="blue"
          icon={<TrendingUp />}
          label="Avg revenue / landlord"
          value={
            totals.paying_landlords > 0
              ? formatMoneyWhole(Math.round(totals.mrr_pence / totals.paying_landlords))
              : '£0'
          }
          delta={{ value: 'Avg', tone: 'info' }}
        />
      </ResponsiveGrid>

      <Card>
        <CardContent className="space-y-4 p-4 lg:p-5">
          <AdminFilterRow>
            <div className="min-w-0 flex-1 sm:max-w-xs">
              <AdminSearchInput
                basePath="/admin/billing"
                initialValue={params.q ?? ''}
                placeholder="Search by landlord, email or company…"
              />
            </div>
            <FilterSelect
              name="tier"
              value={tier}
              basePath="/admin/billing"
              preserve={['q', 'status', 'sort']}
            >
              <option value="all">All plans</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="portfolio">Growth / Enterprise</option>
              <option value="trial">On trial</option>
            </FilterSelect>
            <FilterSelect
              name="status"
              value={status}
              basePath="/admin/billing"
              preserve={['q', 'tier', 'sort']}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="trialing">Trial</option>
              <option value="past_due">Failed</option>
              <option value="canceled">Cancelled</option>
            </FilterSelect>
            <FilterSelect
              name="sort"
              value={sort}
              basePath="/admin/billing"
              preserve={['q', 'tier', 'status']}
            >
              <option value="mrr">Sort: MRR ↓</option>
              <option value="newest">Sort: Newest</option>
              <option value="name">Sort: Name A–Z</option>
            </FilterSelect>
          </AdminFilterRow>

          {failuresInView.length > 0 ? (
            <p className="text-[12px] text-alert">
              {failuresInView.length} failed payment{failuresInView.length === 1 ? '' : 's'} on this
              page.
            </p>
          ) : null}

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-page text-left text-[11px] font-bold uppercase tracking-wider text-ink-light">
                <tr>
                  <th className="px-3 py-2.5 font-bold">Landlord</th>
                  <th className="px-3 py-2.5 font-bold">Plan</th>
                  <th className="px-3 py-2.5 font-bold">Amount</th>
                  <th className="px-3 py-2.5 font-bold">Next billing</th>
                  <th className="px-3 py-2.5 font-bold">Payment method</th>
                  <th className="px-3 py-2.5 font-bold">Status</th>
                  <th className="px-3 py-2.5 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-[13px] text-ink-light" colSpan={7}>
                      No subscriptions match this filter.
                    </td>
                  </tr>
                ) : (
                  result.rows.map((o) => {
                    const failed =
                      o.last_payment_status === 'failed' ||
                      o.status === 'past_due' ||
                      o.status === 'unpaid';
                    return (
                      <tr
                        key={o.org_id}
                        className="border-b border-border-soft transition-colors last:border-b-0 hover:bg-foam/60"
                      >
                        <td className="px-3 py-3">
                          <AvRow
                            size="sm"
                            name={o.owner_name ?? o.name}
                            sub={<span>{o.name}</span>}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <TierPill tier={o.tier} mrrPence={o.mrr_pence} />
                        </td>
                        <td className="px-3 py-3 font-semibold text-ink">
                          {o.status === 'trialing'
                            ? '£0 (trial)'
                            : o.mrr_pence > 0
                              ? `${formatMoneyWhole(o.mrr_pence)}/mo`
                              : '—'}
                        </td>
                        <td className="px-3 py-3 text-[12px] text-ink">
                          {failed ? (
                            <span className="font-semibold text-alert">Overdue</span>
                          ) : (
                            formatNextBilling(o.current_period_end)
                          )}
                        </td>
                        <td className="px-3 py-3 text-[12px] text-ink">
                          {o.payment_method_brand && o.payment_method_last4
                            ? `${capitalize(o.payment_method_brand)} ····${o.payment_method_last4}`
                            : o.status === 'trialing'
                              ? 'No card yet'
                              : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <BillingStatusPill
                            status={o.status}
                            lastPaymentStatus={o.last_payment_status}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <BillingRowActions
                            orgId={o.org_id}
                            stripeCustomerId={o.stripe_customer_id}
                            canEdit={canEdit}
                            hasFailure={failed}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="flex flex-col gap-2 lg:hidden">
            {result.rows.length === 0 ? (
              <p className="text-[13px] text-ink-light">No subscriptions match this filter.</p>
            ) : (
              result.rows.map((o) => {
                const failed =
                  o.last_payment_status === 'failed' ||
                  o.status === 'past_due' ||
                  o.status === 'unpaid';
                return (
                  <div
                    key={o.org_id}
                    className="rounded-card border border-border-soft bg-white p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <AvRow
                        size="sm"
                        name={o.owner_name ?? o.name}
                        sub={
                          <span>
                            {o.name} ·{' '}
                            {o.mrr_pence > 0 ? `${formatMoneyWhole(o.mrr_pence)}/mo` : 'free'}
                          </span>
                        }
                      />
                      <div className="text-right">
                        <TierPill tier={o.tier} mrrPence={o.mrr_pence} />
                        <div className="mt-1">
                          <BillingStatusPill
                            status={o.status}
                            lastPaymentStatus={o.last_payment_status}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-light">
                      <span>
                        {failed
                          ? 'Payment overdue'
                          : `Next ${formatNextBilling(o.current_period_end)}`}
                      </span>
                      <BillingRowActions
                        orgId={o.org_id}
                        stripeCustomerId={o.stripe_customer_id}
                        canEdit={canEdit}
                        hasFailure={failed}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <AdminPagination
            basePath="/admin/billing"
            page={result.page}
            totalPages={result.total_pages}
            preservedParams={{
              q: params.q,
              tier: tier === 'all' ? undefined : tier,
              status: status === 'all' ? undefined : status,
              sort: sort === 'mrr' ? undefined : sort,
              per_page: params.per_page === 25 ? undefined : String(params.per_page),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

type BillingTotals = {
  mrr_pence: number;
  paying_landlords: number;
  failed_count: number;
  churn_pct: number;
};

async function getBillingTotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<BillingTotals> {
  const [subs, breakdown, canceledMonth, totalActive] = await Promise.all([
    supabase
      .from('org_subscriptions')
      .select('mrr_pence, status, last_payment_status', { count: 'exact', head: false })
      .gt('mrr_pence', 0),
    supabase.from('admin_plan_breakdown').select('landlord_count'),
    supabase
      .from('org_subscriptions')
      .select('org_id', { count: 'exact', head: true })
      .eq('status', 'canceled')
      .gte('canceled_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
    supabase
      .from('org_subscriptions')
      .select('org_id', { count: 'exact', head: true })
      .in('status', ['active', 'trialing', 'past_due']),
  ]);

  const rows = (subs.data ?? []) as Array<{
    mrr_pence: number;
    status: string;
    last_payment_status: string | null;
  }>;

  const mrr_pence = rows.reduce((acc, r) => acc + (r.mrr_pence ?? 0), 0);
  const paying_landlords = rows.filter((r) => (r.mrr_pence ?? 0) > 0).length;
  const failed_count = rows.filter(
    (r) => r.last_payment_status === 'failed' || r.status === 'past_due' || r.status === 'unpaid',
  ).length;

  const canceled = canceledMonth.count ?? 0;
  const active = totalActive.count ?? 0;
  const churn_pct = active > 0 ? (canceled / active) * 100 : 0;

  // Suppress unused warning — breakdown is reserved for future split.
  void breakdown;

  return { mrr_pence, paying_landlords, failed_count, churn_pct };
}

function TierPill({ tier, mrrPence }: { tier: string | null; mrrPence: number }) {
  if (!tier || tier === 'free') return <Badge variant="neutral">Free</Badge>;
  if (tier === 'portfolio') {
    if (mrrPence >= 10_000) {
      return <Badge variant="purple">Enterprise</Badge>;
    }
    return <Badge variant="success">Growth</Badge>;
  }
  const label = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS]?.name ?? tier;
  if (tier === 'pro') return <Badge variant="success">{label}</Badge>;
  return <Badge variant="neutral">{label}</Badge>;
}

function BillingStatusPill({
  status,
  lastPaymentStatus,
}: {
  status: string | null;
  lastPaymentStatus: string | null;
}) {
  if (lastPaymentStatus === 'failed' || status === 'past_due' || status === 'unpaid') {
    return <Badge variant="urgent">Failed</Badge>;
  }
  if (status === 'active') return <Badge variant="active">Active</Badge>;
  if (status === 'trialing') return <Badge variant="warning">Trial</Badge>;
  if (status === 'canceled') return <Badge variant="neutral">Cancelled</Badge>;
  return <Badge variant="neutral">{status ?? '—'}</Badge>;
}

function formatNextBilling(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
