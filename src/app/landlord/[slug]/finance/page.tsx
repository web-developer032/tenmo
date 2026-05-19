import { AlertCircle, ArrowRight, Wallet } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/core/utils/money';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { ChargeRow } from '@/features/rent/components/charge-row';
import { loadOrgRentDashboard } from '@/features/rent/loaders';

type Params = { slug: string };

export const dynamic = 'force-dynamic';

/**
 * Landlord rent dashboard.
 *
 * Top: month-at-a-glance (collected vs due, total arrears).
 * Middle: arrears-first list of active tenancies — click into each
 *   for the full ledger and to record manual payments.
 * Bottom: most recent charges feed.
 */
export default async function FinanceDashboardPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const data = await loadOrgRentDashboard(org.id);

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Rent' },
        ]}
        title="Rent"
        description={
          <>
            Rent across your portfolio. Tenants are <strong>never</strong> charged a platform fee.
          </>
        }
      />

      <ResponsiveGrid preset="kpi" className="lg:grid-cols-3">
        <SummaryCard
          label="Collected this month"
          value={formatMoney(data.totalCollectedThisMonthPence)}
          tone="text-forest-700"
        />
        <SummaryCard
          label="Due this month"
          value={formatMoney(data.totalDueThisMonthPence)}
          tone="text-ink"
        />
        <SummaryCard
          label="Total arrears"
          value={formatMoney(data.totalArrearsPence)}
          tone={data.totalArrearsPence > 0 ? 'text-alert' : 'text-ink-light'}
        />
      </ResponsiveGrid>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" />
            Active tenancies
          </CardTitle>
          <CardDescription>
            Sorted by arrears. Click in to view the full rent ledger or record a manual payment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.tenancies.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-6 w-6" />}
              title="No active tenancies yet"
              description="Once you invite a tenant and they accept, their rent ledger will appear here."
              cta={{ label: 'Add a tenancy', href: `/landlord/${slug}/tenancies` }}
            />
          ) : (
            <ul className="divide-y divide-border">
              {data.tenancies.map((t) => (
                <li key={t.tenancyId}>
                  <Link
                    href={`/landlord/${slug}/tenancies/${t.tenancyId}/rent`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-button px-2 py-3 text-[13px] transition-colors hover:bg-foam/60"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-ink">
                        {t.propertyName}
                        {t.roomName ? (
                          <span className="text-ink-light"> — {t.roomName}</span>
                        ) : null}
                      </div>
                      <div className="truncate text-[12px] text-ink-light">
                        {t.tenantName ?? t.tenantEmail ?? 'Tenant'} · {formatMoney(t.rentPence)}{' '}
                        {t.rentFrequency === 'weekly' ? '/wk' : '/mo'}
                        {t.nextDueDate ? <span> · next due {t.nextDueDate}</span> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {t.arrearsPence > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-alert">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {formatMoney(t.arrearsPence)}
                        </span>
                      ) : (
                        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-forest-700">
                          Up to date
                        </span>
                      )}
                      <ArrowRight className="h-4 w-4 text-ink-light" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {data.recentCharges.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-light">
            Recent charges
          </h2>
          <ul className="space-y-2">
            {data.recentCharges.slice(0, 8).map((charge) => (
              <li key={charge.id}>
                <ChargeRow charge={charge} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div>
        <Button variant="ghost" asChild>
          <Link href={`/landlord/${slug}/tenancies`}>Browse tenancies →</Link>
        </Button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-ink-light">
          {label}
        </div>
        <div className={`font-sans text-[26px] font-extrabold ${tone ?? 'text-ink'}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
