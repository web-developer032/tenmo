import { HardHat } from 'lucide-react';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { type Column, DataTable } from '@/components/ds/data-table';
import { PageHeader } from '@/components/ds/page-header';
import { SectionCard } from '@/components/ds/section-card';
import { TabBar, type TabItem } from '@/components/ds/tab-bar';
import { AddContractorModal } from '@/features/contractors/components/add-contractor-modal';
import {
  type ContractorRow,
  type ContractorTrade,
  loadLandlordContractors,
} from '@/features/contractors/load-landlord-contractors';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };
type Search = { tab?: string };

export const dynamic = 'force-dynamic';

const TRADE_LABELS: Record<ContractorTrade, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  gas: 'Gas',
  general: 'General',
  security: 'Security',
  heating: 'Heating',
  locksmith: 'Locksmith',
  roofing: 'Roofing',
  cleaning: 'Cleaning',
};

const TRADE_TONES: Record<ContractorTrade, string> = {
  plumbing: 'bg-blue-bg text-blue',
  electrical: 'bg-amber-bg text-amber',
  gas: 'bg-alert-bg text-alert',
  general: 'bg-foam text-forest-700',
  security: 'bg-purple-bg text-purple',
  heating: 'bg-amber-bg text-amber',
  locksmith: 'bg-purple-bg text-purple',
  roofing: 'bg-sand text-ink-mid',
  cleaning: 'bg-foam text-forest-700',
};

const TAB_ORDER: ContractorTrade[] = [
  'plumbing',
  'electrical',
  'gas',
  'general',
  'security',
  'heating',
  'locksmith',
  'roofing',
  'cleaning',
];

export default async function LandlordContractorsPage({
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
  const { rows, counts } = await loadLandlordContractors(supabase, org.id);

  const visibleTrades = TAB_ORDER.filter((t) => counts[t] > 0);

  const tabs: TabItem[] = [
    { id: 'all', label: 'All', count: counts.all, href: `/landlord/${slug}/contractors` },
    ...visibleTrades.map((t) => ({
      id: t,
      label: TRADE_LABELS[t],
      count: counts[t],
      href: `/landlord/${slug}/contractors?tab=${t}`,
    })),
  ];

  const filtered = rows.filter((r) => {
    if (tab === 'all') return true;
    return r.trades.includes(tab as ContractorTrade);
  });

  const columns: Column<ContractorRow>[] = [
    {
      id: 'name',
      header: 'Contractor',
      mobile: 'primary',
      cell: (r) => (
        <div>
          <div className="font-bold text-ink">{r.name}</div>
          {r.contactName ? <div className="text-[11px] text-ink-light">{r.contactName}</div> : null}
        </div>
      ),
    },
    {
      id: 'trade',
      header: 'Trade',
      mobile: 'meta',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.trades.map((t) => (
            <span
              key={t}
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                TRADE_TONES[t] ?? 'bg-sand text-ink-mid',
              )}
            >
              {TRADE_LABELS[t]}
            </span>
          ))}
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'Contact',
      mobile: 'secondary',
      cell: (r) => (
        <div className="text-[12px]">
          {r.phone ? <div className="text-ink">{r.phone}</div> : null}
          {r.email ? <div className="text-blue">{r.email}</div> : null}
          {!r.phone && !r.email ? <span className="text-ink-light">—</span> : null}
        </div>
      ),
    },
    {
      id: 'coverage',
      header: 'Coverage',
      cell: (r) => (r.coverageAreas.length > 0 ? r.coverageAreas.join(', ') : '—'),
    },
    {
      id: 'rate',
      header: 'Day rate',
      align: 'right',
      cell: (r) =>
        r.dayRatePence ? (
          <strong className="text-ink">{fmtMoney(r.dayRatePence)}/day</strong>
        ) : (
          <span className="text-ink-light">—</span>
        ),
    },
    {
      id: 'cert',
      header: 'Gas Safe / NICEIC',
      cell: (r) => (
        <div className="space-y-1">
          {r.gasSafeNumber ? (
            <span className="inline-flex items-center rounded-full bg-foam px-2.5 py-0.5 text-[11px] font-bold text-forest-700">
              Gas Safe #{r.gasSafeNumber}
            </span>
          ) : null}
          {r.niceicNumber ? (
            <span className="inline-flex items-center rounded-full bg-foam px-2.5 py-0.5 text-[11px] font-bold text-forest-700">
              NICEIC #{r.niceicNumber}
            </span>
          ) : null}
          {!r.gasSafeNumber && !r.niceicNumber ? <span className="text-ink-light">—</span> : null}
        </div>
      ),
    },
    {
      id: 'used',
      header: 'Last used',
      cell: (r) => (r.lastUsedAt ? fmtShort(r.lastUsedAt) : '—'),
    },
    {
      id: 'rating',
      header: 'Rating',
      cell: (r) => <RatingStars rating={r.rating} />,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: () => <span className="text-[12.5px] font-semibold text-forest-600">Edit →</span>,
    },
  ];

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Contractors' },
        ]}
        title="Contractors"
        description="Your trusted supplier directory for maintenance and compliance"
        actions={<AddContractorModal slug={slug} />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<HardHat className="h-6 w-6" />}
          title="No contractors saved yet"
          description="Add your first trusted contractor — we'll plug them straight into maintenance tickets and compliance renewals."
        />
      ) : (
        <>
          <TabBar items={tabs} activeId={tab} />
          <SectionCard padded={false}>
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(r) => r.id}
              emptyState={
                <p className="text-[13px] text-ink-light">No contractors match this filter.</p>
              }
              className="border-0 lg:rounded-none lg:border-0"
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}

function RatingStars({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-ink-light">—</span>;
  return (
    <span className="text-amber" title={`${rating} out of 5`}>
      <span className="sr-only">{`Rated ${rating} out of 5`}</span>
      {'★'.repeat(rating)}
      <span className="text-ink-light">{'☆'.repeat(5 - rating)}</span>
    </span>
  );
}

function fmtMoney(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function fmtShort(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 86_400_000;
  if (diff < 1) return 'Today';
  if (diff < 7) return `${Math.round(diff)} day${Math.round(diff) === 1 ? '' : 's'} ago`;
  return d.toLocaleString('en-GB', { month: 'short', year: 'numeric' });
}
