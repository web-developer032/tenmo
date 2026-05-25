import { Plus, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { Banner } from '@/components/ds/banner';
import { type Column, DataTable } from '@/components/ds/data-table';
import { PageHeader } from '@/components/ds/page-header';
import { SectionCard } from '@/components/ds/section-card';
import { TabBar, type TabItem } from '@/components/ds/tab-bar';
import { Button } from '@/components/ui/button';
import {
  type ComplianceItemWithContext,
  loadOrgComplianceOverview,
} from '@/features/compliance/loaders';
import { formatComplianceType } from '@/features/landlord-dashboard/load-landlord-dashboard';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { cn } from '@/lib/cn';

type Params = { slug: string };
type Search = { tab?: string };

export const dynamic = 'force-dynamic';

export default async function ComplianceDashboardPage({
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

  const { flatItems, flatGroups } = await loadOrgComplianceOverview(org.id);

  const valid = flatGroups.ok.length;
  const dueSoon = flatGroups.due_soon.length;
  const overdue = flatGroups.overdue.length;
  const unknown = flatGroups.unknown.length;

  // Build tab list with by-kind filters that only show when there are rows.
  const kinds = Array.from(new Set(flatItems.map((i) => i.type))).sort();
  const tabs: TabItem[] = [
    { id: 'all', label: 'All', count: flatItems.length, href: tabHref(slug, 'all') },
    { id: 'expiring', label: 'Expiring', count: dueSoon, href: tabHref(slug, 'expiring') },
    { id: 'overdue', label: 'Overdue', count: overdue, href: tabHref(slug, 'overdue') },
    ...kinds.map((k) => ({
      id: k,
      label: formatComplianceType(k),
      count: flatItems.filter((i) => i.type === k).length,
      href: tabHref(slug, k),
    })),
  ];

  const filtered = flatItems.filter((i) => {
    if (tab === 'all') return true;
    if (tab === 'expiring') return i.status === 'due_soon';
    if (tab === 'overdue') return i.status === 'overdue';
    return i.type === tab;
  });

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const columns: Column<ComplianceItemWithContext>[] = [
    {
      id: 'cert',
      header: 'Certificate',
      mobile: 'primary',
      cell: (i) => <span className="font-semibold text-ink">{formatComplianceType(i.type)}</span>,
    },
    {
      id: 'property',
      header: 'Property',
      mobile: 'secondary',
      cell: (i) => i.property_name ?? 'Portfolio-wide',
    },
    {
      id: 'issued',
      header: 'Issued',
      cell: (i) => (i.issued_at ? formatMonth(i.issued_at) : '—'),
    },
    {
      id: 'expires',
      header: 'Expires',
      cell: (i) => (i.expires_at ? formatShort(i.expires_at) : '—'),
    },
    {
      id: 'days',
      header: 'Days remaining',
      align: 'right',
      cell: (i) => <DaysRemaining expiresAt={i.expires_at ?? null} todayIso={todayIso} />,
    },
    {
      id: 'status',
      header: 'Status',
      mobile: 'meta',
      cell: (i) => <ComplianceStatusPill status={i.status} />,
    },
    {
      id: 'doc',
      header: 'Document',
      cell: (i) =>
        i.document_path ? (
          <span className="text-[12px] font-semibold text-blue">View PDF</span>
        ) : (
          <span className="text-[12px] text-ink-light">—</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (i) => (
        <Link
          href={`/landlord/${slug}/compliance/${i.id}`}
          className={cn(
            'text-[12.5px] font-semibold hover:underline',
            i.status === 'due_soon' || i.status === 'overdue' ? 'text-amber' : 'text-forest-600',
          )}
        >
          {i.status === 'due_soon' || i.status === 'overdue' ? 'Renew →' : 'Edit →'}
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Compliance' },
        ]}
        title="Compliance"
        description={
          flatItems.length === 0
            ? 'Add a certificate to start tracking expiries and stay HMO-compliant.'
            : `${valid} valid · ${dueSoon} expiring soon · ${overdue} expired${unknown > 0 ? ` · ${unknown} unknown` : ''}`
        }
        actions={
          <Button asChild>
            <Link href={`/landlord/${slug}/compliance/new`}>
              <Plus className="h-4 w-4" /> Upload certificate
            </Link>
          </Button>
        }
      />

      {overdue > 0 ? (
        <Banner
          tone="alert"
          title={`${overdue} certificate${overdue === 1 ? '' : 's'} expired`}
          description="Renew now to stay compliant with HMO licensing and Fitness for Habitation."
          actions={
            <Link
              href={`/landlord/${slug}/compliance?tab=overdue`}
              className="text-[12.5px] font-bold text-alert hover:underline"
            >
              Review →
            </Link>
          }
        />
      ) : null}

      {flatItems.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="No certificates tracked yet"
          description="Add your gas safety cert, EICR or HMO licence to start tracking expiries."
          cta={{ label: 'Add a certificate', href: `/landlord/${slug}/compliance/new` }}
        />
      ) : (
        <>
          <TabBar items={tabs} activeId={tab} />
          <SectionCard padded={false}>
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(i) => i.id}
              rowHref={(i) => `/landlord/${slug}/compliance/${i.id}`}
              emptyState={
                <p className="text-[13px] text-ink-light">No certificates match this filter.</p>
              }
              className="border-0 lg:rounded-none lg:border-0"
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}

function DaysRemaining({ expiresAt, todayIso }: { expiresAt: string | null; todayIso: string }) {
  if (!expiresAt) return <span className="text-ink-light">—</span>;
  const days = Math.round(
    (new Date(`${expiresAt}T00:00:00Z`).getTime() - new Date(`${todayIso}T00:00:00Z`).getTime()) /
      86_400_000,
  );
  const tone = days < 0 ? 'text-alert' : days < 60 ? 'text-amber' : 'text-forest-600';
  return (
    <span className={cn('font-semibold', tone)}>
      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
    </span>
  );
}

function ComplianceStatusPill({ status }: { status: string }) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold';
  switch (status) {
    case 'ok':
      return <span className={cn(base, 'bg-foam text-forest-700')}>Valid</span>;
    case 'due_soon':
      return <span className={cn(base, 'bg-amber-bg text-amber')}>Expiring</span>;
    case 'overdue':
      return <span className={cn(base, 'bg-alert-bg text-alert')}>Overdue</span>;
    default:
      return <span className={cn(base, 'bg-sand text-ink-mid')}>Unknown</span>;
  }
}

function formatMonth(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { month: 'short', year: 'numeric' });
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function tabHref(slug: string, tab: string): string {
  return tab === 'all'
    ? `/landlord/${slug}/compliance`
    : `/landlord/${slug}/compliance?tab=${encodeURIComponent(tab)}`;
}
