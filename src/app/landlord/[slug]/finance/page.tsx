import { CalendarRange, Download, Plus, Wallet } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { AvRow } from '@/components/ds/av-row';
import { type Column, DataTable } from '@/components/ds/data-table';
import { KpiCard } from '@/components/ds/kpi-card';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { SectionCard } from '@/components/ds/section-card';
import { Button } from '@/components/ui/button';
import { formatMoneyShort, formatMoneyWhole } from '@/core/utils/money';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { loadRentMonth, type RentMonthRow } from '@/features/rent/load-rent-month';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };
type Search = { month?: string };

export const dynamic = 'force-dynamic';

export default async function LandlordRentPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<Search>;
}) {
  const { slug } = await params;
  const { month } = (await searchParams) ?? {};
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const supabase = await createClient();
  const data = await loadRentMonth(
    supabase,
    org.id,
    `${month ?? new Date().toISOString().slice(0, 7)}-01`,
  );

  const columns: Column<RentMonthRow>[] = [
    {
      id: 'tenant',
      header: 'Tenant',
      mobile: 'primary',
      cell: (r) => <AvRow name={r.tenantName} size="sm" />,
    },
    {
      id: 'where',
      header: 'Property / Room',
      mobile: 'secondary',
      cell: (r) => (
        <span className="text-ink">
          {r.propertyName ?? '—'}
          {r.roomName ? ` · ${r.roomName}` : ''}
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (r) => <span className="font-semibold">{formatMoneyWhole(r.amountPence)}</span>,
    },
    {
      id: 'due',
      header: 'Due',
      cell: (r) => formatShort(r.dueDate),
    },
    {
      id: 'received',
      header: 'Received',
      cell: (r) => (r.receivedOn ? formatShort(r.receivedOn) : '—'),
    },
    {
      id: 'method',
      header: 'Method',
      cell: (r) => formatMethod(r.method),
    },
    {
      id: 'status',
      header: 'Status',
      mobile: 'meta',
      cell: (r) => <RentStatusPill row={r} />,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (r) => <RentRowActions row={r} slug={slug} />,
    },
  ];

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
            {data.monthLabel} · <strong>{formatMoneyWhole(data.kpis.collectedPence)}</strong>{' '}
            collected
            {data.kpis.outstandingPence > 0 ? (
              <>
                {' · '}
                <span className="text-alert">
                  {formatMoneyWhole(data.kpis.outstandingPence)} outstanding
                </span>
              </>
            ) : null}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MonthPicker
              slug={slug}
              months={data.availableMonths}
              active={data.monthIso.slice(0, 7)}
            />
            <Button asChild variant="outline">
              <Link href={`/landlord/${slug}/tenancies`}>
                <Plus className="h-4 w-4" /> Record payment
              </Link>
            </Button>
            <Button asChild>
              <Link
                href={`/api/landlord/${slug}/rent/export?month=${data.monthIso.slice(0, 7)}`}
                prefetch={false}
              >
                <Download className="h-4 w-4" /> Export CSV
              </Link>
            </Button>
          </div>
        }
      />

      <ResponsiveGrid preset="kpi">
        <KpiCard
          label="Collected"
          value={formatMoneyShort(data.kpis.collectedPence)}
          icon={<Wallet />}
          accent="forest"
          delta={{ value: `${data.kpis.collectionPct}%`, tone: 'up' }}
        />
        <KpiCard
          label="Overdue"
          value={formatMoneyShort(data.kpis.outstandingPence)}
          icon={<Wallet />}
          accent={data.kpis.outstandingPence > 0 ? 'red' : 'forest'}
          delta={
            data.kpis.overdueTenantsCount > 0
              ? {
                  value: `${data.kpis.overdueTenantsCount} tenant${data.kpis.overdueTenantsCount === 1 ? '' : 's'}`,
                  tone: 'down',
                }
              : undefined
          }
        />
        <KpiCard
          label="Due this week"
          value={formatMoneyShort(data.kpis.dueThisWeekPence)}
          icon={<CalendarRange />}
          accent="amber"
          delta={
            data.kpis.dueThisWeekTenantsCount > 0
              ? {
                  value: `${data.kpis.dueThisWeekTenantsCount} tenant${data.kpis.dueThisWeekTenantsCount === 1 ? '' : 's'}`,
                  tone: 'warn',
                }
              : undefined
          }
        />
        <KpiCard
          label="Monthly total due"
          value={formatMoneyShort(data.kpis.monthlyTotalDuePence)}
          icon={<Wallet />}
          accent="blue"
        />
      </ResponsiveGrid>

      {data.rows.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title={`No charges in ${data.monthLabel}`}
          description="Add a tenancy or wait for the monthly rent run — charges will appear here automatically."
          cta={{ label: 'Browse tenancies', href: `/landlord/${slug}/tenancies` }}
        />
      ) : (
        <SectionCard padded={false}>
          <DataTable
            columns={columns}
            rows={data.rows}
            rowKey={(r) => r.id}
            emptyState={<p className="text-[13px] text-ink-light">No charges this month.</p>}
            className="border-0 lg:rounded-none lg:border-0"
          />
        </SectionCard>
      )}
    </div>
  );
}

function MonthPicker({ slug, months, active }: { slug: string; months: string[]; active: string }) {
  const list = months.length > 0 ? months : [active];
  return (
    <form action={`/landlord/${slug}/finance`} method="get" className="flex items-center gap-2">
      <label className="sr-only" htmlFor="month-select">
        Month
      </label>
      <select
        id="month-select"
        name="month"
        defaultValue={active}
        className="h-9 rounded-button border border-border-soft bg-white px-3 text-[12.5px] font-semibold text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
      >
        {list.map((m) => (
          <option key={m} value={m}>
            {new Date(`${m}-01`).toLocaleString('en-GB', { month: 'long', year: 'numeric' })}
          </option>
        ))}
      </select>
      <Button type="submit" variant="ghost" size="sm">
        Go
      </Button>
    </form>
  );
}

function RentRowActions({ row, slug }: { row: RentMonthRow; slug: string }) {
  if (row.status === 'paid') {
    return (
      <Link
        href={`/landlord/${slug}/tenancies/${row.tenancyId}/rent`}
        className="text-[12.5px] font-semibold text-forest-600 hover:underline"
      >
        View →
      </Link>
    );
  }
  return (
    <div className="flex items-center justify-end gap-3">
      <Link
        href={`/landlord/${slug}/tenancies/${row.tenancyId}/rent`}
        className="text-[12.5px] font-semibold text-forest-600 hover:underline"
      >
        Record →
      </Link>
      {row.status === 'overdue' ? (
        <Link
          href={`/messages?ticket=${row.tenancyId}`}
          className="text-[12.5px] font-semibold text-alert hover:underline"
        >
          Chase →
        </Link>
      ) : null}
    </div>
  );
}

function RentStatusPill({ row }: { row: RentMonthRow }) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold';
  switch (row.status) {
    case 'paid':
      return <span className={cn(base, 'bg-foam text-forest-700')}>Paid</span>;
    case 'overdue':
      return (
        <span className={cn(base, 'bg-alert-bg text-alert')}>
          {Math.abs(row.daysFromDue)}d overdue
        </span>
      );
    case 'due':
      return (
        <span className={cn(base, 'bg-amber-bg text-amber')}>
          {row.daysFromDue <= 0 ? 'Due today' : `Due in ${row.daysFromDue}d`}
        </span>
      );
    case 'partial':
      return <span className={cn(base, 'bg-blue-bg text-blue')}>Partial</span>;
    default:
      return <span className={cn(base, 'bg-sand text-ink-mid')}>{row.status}</span>;
  }
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short' });
}

function formatMethod(m: string | null): string {
  if (!m) return '—';
  const labels: Record<string, string> = {
    manual_bank_transfer: 'Bank transfer',
    manual_cash: 'Cash',
    manual_card: 'Card',
    gocardless: 'GoCardless',
    stripe: 'Stripe',
  };
  return labels[m] ?? m.replace(/_/g, ' ');
}
