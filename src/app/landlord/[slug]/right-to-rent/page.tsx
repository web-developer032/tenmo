import { ScrollText } from 'lucide-react';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { Banner } from '@/components/ds/banner';
import { type Column, DataTable } from '@/components/ds/data-table';
import { PageHeader } from '@/components/ds/page-header';
import { SectionCard } from '@/components/ds/section-card';
import { TabBar, type TabItem } from '@/components/ds/tab-bar';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { LogRtrModal } from '@/features/right-to-rent/components/log-rtr-modal';
import {
  loadLandlordRtr,
  type RtrDocumentType,
  type RtrRow,
} from '@/features/right-to-rent/load-landlord-rtr';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };
type Search = { tab?: 'all' | 'recheck' | 'verified' };

export const dynamic = 'force-dynamic';

const DOC_LABELS: Record<RtrDocumentType, string> = {
  british_passport: 'British passport',
  brp_card: 'BRP card',
  share_code: 'Share code (UKVI)',
  eu_settlement: 'EU Settlement (ILR)',
  other: 'Other',
};

export default async function LandlordRightToRentPage({
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
  const { rows, kpis, recheckBanner } = await loadLandlordRtr(supabase, org.id);

  const tenancyOptions = rows.map((r) => ({
    id: r.tenancyId,
    label: `${r.tenantName} · ${r.propertyName}${r.roomName ? ` · ${r.roomName}` : ''}`,
  }));

  const tabs: TabItem[] = [
    { id: 'all', label: 'All', count: kpis.total, href: `/landlord/${slug}/right-to-rent` },
    {
      id: 'recheck',
      label: 'Re-check due',
      count: kpis.recheckDue + kpis.recheckOverdue,
      href: `/landlord/${slug}/right-to-rent?tab=recheck`,
    },
    {
      id: 'verified',
      label: 'Verified',
      count: kpis.verified,
      href: `/landlord/${slug}/right-to-rent?tab=verified`,
    },
  ];

  const filtered = rows.filter((r) => {
    if (tab === 'recheck') return r.status === 'recheck_due' || r.status === 'recheck_overdue';
    if (tab === 'verified') return r.status === 'verified';
    return true;
  });

  const columns: Column<RtrRow>[] = [
    {
      id: 'tenant',
      header: 'Tenant',
      mobile: 'primary',
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ backgroundColor: r.tenantColour }}
            aria-hidden
          >
            {r.tenantInitials}
          </div>
          <span className="text-[13px] font-semibold text-ink">{r.tenantName}</span>
        </div>
      ),
    },
    {
      id: 'property',
      header: 'Property / Room',
      mobile: 'secondary',
      cell: (r) => (
        <span className="text-[13px] text-ink">
          {r.propertyName}
          {r.roomName ? ` · ${r.roomName}` : ''}
        </span>
      ),
    },
    {
      id: 'doc',
      header: 'Document type',
      cell: (r) => (r.documentType ? DOC_LABELS[r.documentType] : '—'),
    },
    {
      id: 'share',
      header: 'Share code / Ref',
      cell: (r) => r.shareCode ?? '—',
    },
    {
      id: 'checked',
      header: 'Check date',
      cell: (r) => (r.checkedAt ? fmtShort(r.checkedAt) : '—'),
    },
    {
      id: 'expires',
      header: 'Re-check due',
      cell: (r) =>
        r.expiresAt ? (
          <span
            className={cn(
              'font-semibold',
              r.status === 'recheck_overdue'
                ? 'text-alert'
                : r.status === 'recheck_due'
                  ? 'text-amber'
                  : 'text-ink',
            )}
          >
            {fmtShort(r.expiresAt)}
          </span>
        ) : (
          'N/A'
        ),
    },
    {
      id: 'status',
      header: 'Status',
      mobile: 'meta',
      cell: (r) => <RtrStatusPill status={r.status} />,
    },
    {
      id: 'evidence',
      header: 'Evidence',
      cell: (r) =>
        r.evidenceDocumentId ? (
          <span className="text-[12px] font-semibold text-blue">View scan</span>
        ) : (
          <span className="text-[12px] text-ink-light">—</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <span
          className={cn(
            'text-[12.5px] font-semibold',
            r.status === 'recheck_due' || r.status === 'recheck_overdue'
              ? 'text-amber'
              : 'text-forest-600',
          )}
        >
          {r.status === 'recheck_due' || r.status === 'recheck_overdue' ? 'Re-check →' : 'Edit →'}
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
          { label: 'Right to Rent' },
        ]}
        title="Right to Rent"
        description={
          rows.length === 0
            ? "Log a Right-to-Rent check against each tenancy. We'll remind you before any time-limited leave expires."
            : `${kpis.total} check${kpis.total === 1 ? '' : 's'} on record · ${kpis.recheckDue + kpis.recheckOverdue} re-check${kpis.recheckDue + kpis.recheckOverdue === 1 ? '' : 's'} due`
        }
        actions={<LogRtrModal slug={slug} tenancies={tenancyOptions} />}
      />

      {recheckBanner ? (
        <Banner
          tone="warn"
          title={`Re-check required — ${recheckBanner.tenantName}`}
          description={
            recheckBanner.expiresAt
              ? `Time-limited leave to remain expires ${fmtShort(recheckBanner.expiresAt)}. Re-check must be completed before expiry.`
              : 'A re-check is due for this tenancy. Schedule a new verification soon.'
          }
          actions={
            <LogRtrModal
              slug={slug}
              tenancies={tenancyOptions}
              initialTenancyId={recheckBanner.tenancyId}
              triggerLabel="Schedule re-check"
              triggerVariant="ghost"
            />
          }
        />
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-6 w-6" />}
          title="No RtR checks yet"
          description="Log the evidence you reviewed for each adult occupier — we'll track the next deadline for you."
        />
      ) : (
        <>
          <TabBar items={tabs} activeId={tab} />
          <SectionCard padded={false}>
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(r) => r.tenancyId}
              emptyState={
                <p className="text-[13px] text-ink-light">No tenancies match this filter.</p>
              }
              className="border-0 lg:rounded-none lg:border-0"
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}

function RtrStatusPill({ status }: { status: RtrRow['status'] }) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold';
  switch (status) {
    case 'verified':
      return <span className={cn(base, 'bg-foam text-forest-700')}>Verified</span>;
    case 'recheck_due':
      return <span className={cn(base, 'bg-amber-bg text-amber')}>Re-check due</span>;
    case 'recheck_overdue':
      return <span className={cn(base, 'bg-alert-bg text-alert')}>Overdue</span>;
    default:
      return <span className={cn(base, 'bg-sand text-ink-mid')}>Unverified</span>;
  }
}

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
