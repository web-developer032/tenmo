import { AlertCircle, ArrowRight, Wallet } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
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
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Finance</h1>
          <p className="text-sm text-muted-foreground">
            Rent across your portfolio. Tenants are <strong>never</strong> charged a platform fee.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryCard
          label="Collected this month"
          value={formatMoney(data.totalCollectedThisMonthPence)}
          tone="text-emerald-700 dark:text-emerald-300"
        />
        <SummaryCard
          label="Due this month"
          value={formatMoney(data.totalDueThisMonthPence)}
          tone="text-foreground"
        />
        <SummaryCard
          label="Total arrears"
          value={formatMoney(data.totalArrearsPence)}
          tone={
            data.totalArrearsPence > 0 ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground'
          }
        />
      </div>

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
                    className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {t.propertyName}
                        {t.roomName ? (
                          <span className="text-muted-foreground"> — {t.roomName}</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {t.tenantName ?? t.tenantEmail ?? 'Tenant'} · {formatMoney(t.rentPence)}{' '}
                        {t.rentFrequency === 'weekly' ? '/wk' : '/mo'}
                        {t.nextDueDate ? <span> · next due {t.nextDueDate}</span> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {t.arrearsPence > 0 ? (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-700 dark:text-red-300">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {formatMoney(t.arrearsPence)}
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-700 dark:text-emerald-300">
                          Up to date
                        </span>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
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
      <CardContent className="space-y-1 py-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold ${tone ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
