import { ArrowRight, Home, Plus } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { AvRow } from '@/components/ds/av-row';
import { type Column, DataTable } from '@/components/ds/data-table';
import { PageHeader } from '@/components/ds/page-header';
import { SectionCard } from '@/components/ds/section-card';
import { TabBar, type TabItem } from '@/components/ds/tab-bar';
import { Button } from '@/components/ui/button';
import { formatMoneyWhole } from '@/core/utils/money';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { loadLandlordTenants, type TenantRow } from '@/features/tenancies/load-landlord-tenants';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };
type Search = { tab?: string };

const ENDING_SOON_DAYS = 60;

export default async function LandlordTenantsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<Search>;
}) {
  const { slug } = await params;
  const { tab = 'all' } = (await searchParams) ?? {};
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const supabase = await createClient();
  const rows = await loadLandlordTenants(supabase, org.id);

  const overdue = rows.filter((r) => r.paymentStatus === 'overdue');
  const dueSoon = rows.filter(
    (r) => r.paymentStatus === 'due' && r.paymentDaysFromDue >= 0 && r.paymentDaysFromDue <= 7,
  );
  const now = new Date();
  const endingSoon = rows.filter((r) => {
    if (!r.endDate) return false;
    const diff = (new Date(r.endDate).getTime() - now.getTime()) / 86_400_000;
    return diff >= 0 && diff <= ENDING_SOON_DAYS;
  });

  const tabs: TabItem[] = [
    { id: 'all', label: 'All', count: rows.length, href: tabHref(slug, 'all') },
    { id: 'overdue', label: 'Overdue', count: overdue.length, href: tabHref(slug, 'overdue') },
    { id: 'due-soon', label: 'Due soon', count: dueSoon.length, href: tabHref(slug, 'due-soon') },
    { id: 'ending', label: 'Ending', count: endingSoon.length, href: tabHref(slug, 'ending') },
  ];

  const filtered =
    tab === 'overdue'
      ? overdue
      : tab === 'due-soon'
        ? dueSoon
        : tab === 'ending'
          ? endingSoon
          : rows;

  const columns: Column<TenantRow>[] = [
    {
      id: 'tenant',
      header: 'Tenant',
      mobile: 'primary',
      cell: (r) => <AvRow name={r.tenantName} sub={r.tenantPhone ?? undefined} size="sm" />,
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
      id: 'rent',
      header: 'Rent',
      align: 'right',
      cell: (r) => (
        <span className="font-semibold text-ink">
          {formatMoneyWhole(r.rentPence)}
          <span className="font-medium text-ink-light">
            /{r.rentFrequency === 'weekly' ? 'wk' : 'mo'}
          </span>
        </span>
      ),
    },
    {
      id: 'window',
      header: 'Tenancy dates',
      cell: (r) => (
        <span className="text-ink">
          {formatMonth(r.startDate)} – {r.endDate ? formatMonth(r.endDate) : 'Periodic'}
        </span>
      ),
    },
    {
      id: 'deposit',
      header: 'Deposit',
      cell: (r) => (
        <span className="text-ink">
          {formatMoneyWhole(r.depositPence)}
          {r.depositScheme ? ` · ${r.depositScheme.toUpperCase()}` : ''}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Payment status',
      mobile: 'meta',
      cell: (r) => <PaymentStatusPill row={r} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (_r) => (
        <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-forest-600">
          View <ArrowRight className="h-3.5 w-3.5" />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Tenants' },
        ]}
        title="Tenants"
        description={
          rows.length === 0
            ? 'Invite tenants from any property to get started — they are free, forever.'
            : `${rows.length} active tenant${rows.length === 1 ? '' : 's'}${endingSoon.length ? ` · ${endingSoon.length} ending soon` : ''}`
        }
        actions={
          <Button asChild>
            <Link href={`/landlord/${slug}/properties`}>
              <Plus className="h-4 w-4" /> Invite tenant
            </Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Home className="h-6 w-6" />}
          title="No tenants yet"
          description="Invite a tenant from any property to get started. Your tenants are free, forever."
          cta={{ label: 'Choose a property', href: `/landlord/${slug}/properties` }}
        />
      ) : (
        <>
          <TabBar items={tabs} activeId={tab} />
          <SectionCard padded={false}>
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(r) => r.id}
              rowHref={(r) => `/landlord/${slug}/tenancies/${r.id}`}
              emptyState={
                <p className="text-[13px] text-ink-light">No tenants match this filter.</p>
              }
              className="border-0 lg:rounded-none lg:border-0"
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}

function PaymentStatusPill({ row }: { row: TenantRow }) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold';
  switch (row.paymentStatus) {
    case 'paid':
      return <span className={cn(base, 'bg-foam text-forest-700')}>Paid</span>;
    case 'overdue':
      return (
        <span className={cn(base, 'bg-alert-bg text-alert')}>
          {Math.abs(row.paymentDaysFromDue)}d overdue
        </span>
      );
    case 'due':
      return (
        <span className={cn(base, 'bg-amber-bg text-amber')}>
          {row.paymentDaysFromDue <= 0 ? 'Due today' : `Due in ${row.paymentDaysFromDue}d`}
        </span>
      );
    case 'partial':
      return <span className={cn(base, 'bg-blue-bg text-blue')}>Partial</span>;
    case 'no_charge':
      return <span className={cn(base, 'bg-sand text-ink-mid')}>Pending</span>;
    default:
      return <span className={cn(base, 'bg-sand text-ink-mid')}>{row.paymentStatus}</span>;
  }
}

function formatMonth(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { month: 'short', year: 'numeric' });
}

function tabHref(slug: string, tab: string): string {
  return tab === 'all'
    ? `/landlord/${slug}/tenancies`
    : `/landlord/${slug}/tenancies?tab=${encodeURIComponent(tab)}`;
}
