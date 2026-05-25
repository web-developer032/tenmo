import { ArrowRight, DoorOpen, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { type Column, DataTable } from '@/components/ds/data-table';
import { PageHeader } from '@/components/ds/page-header';
import { SectionCard } from '@/components/ds/section-card';
import { TabBar, type TabItem } from '@/components/ds/tab-bar';
import { Button } from '@/components/ui/button';
import { formatMoneyWhole } from '@/core/utils/money';
import { ListingStatusBadge } from '@/features/listings/components/listing-status-badge';
import { type LandlordRoomListingRow, loadLandlordListings } from '@/features/listings/loaders';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Params = { slug: string };
type Search = { tab?: string };

export default async function LandlordListingsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<Search>;
}) {
  const { slug } = await params;
  const { tab = 'all' } = (await searchParams) ?? {};
  const supabase = await createClient();
  const { data: org } = await supabase.from('orgs').select('id').eq('slug', slug).maybeSingle();
  if (!org) notFound();

  const rows = await loadLandlordListings(org.id);
  const live = rows.filter((r) => r.listing_status === 'published');
  const drafts = rows.filter((r) => r.listing_status === 'draft');
  const paused = rows.filter((r) => r.listing_status === 'paused');
  const closed = rows.filter((r) => r.listing_status === 'closed');
  const vacant = live.length;
  const totalApplications = rows.reduce((sum, r) => sum + r.pending_application_count, 0);

  const tabs: TabItem[] = [
    { id: 'all', label: 'All', count: rows.length, href: tabHref(slug, 'all') },
    { id: 'live', label: 'Live', count: live.length, href: tabHref(slug, 'live') },
    { id: 'draft', label: 'Draft', count: drafts.length, href: tabHref(slug, 'draft') },
    { id: 'paused', label: 'Paused', count: paused.length, href: tabHref(slug, 'paused') },
    { id: 'closed', label: 'Closed', count: closed.length, href: tabHref(slug, 'closed') },
  ];

  const filtered = rows.filter((r) => {
    if (tab === 'all') return true;
    if (tab === 'live') return r.listing_status === 'published';
    return r.listing_status === tab;
  });

  const columns: Column<LandlordRoomListingRow>[] = [
    {
      id: 'room',
      header: 'Room',
      mobile: 'primary',
      cell: (r) => <span className="font-semibold text-ink">{r.name}</span>,
    },
    {
      id: 'property',
      header: 'Property',
      mobile: 'secondary',
      cell: (r) => (
        <span className="text-ink">
          {r.property_name}
          {r.property_city ? `, ${r.property_city}` : ''}
        </span>
      ),
    },
    {
      id: 'rent',
      header: 'Rent',
      align: 'right',
      cell: (r) =>
        r.default_rent_pence ? (
          <span className="font-semibold text-forest-700">
            {formatMoneyWhole(r.default_rent_pence)}
            <span className="font-medium text-ink-light">
              {r.default_rent_frequency === 'weekly' ? '/wk' : '/mo'}
            </span>
          </span>
        ) : (
          '—'
        ),
    },
    {
      id: 'available',
      header: 'Available from',
      cell: (r) => formatAvailableFrom(r.listing_available_from),
    },
    {
      id: 'views',
      header: 'Views',
      align: 'right',
      cell: (r) => (r.views > 0 ? r.views : '—'),
    },
    {
      id: 'applicants',
      header: 'Applicants',
      align: 'right',
      cell: (r) =>
        r.pending_application_count > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-foam px-2.5 py-0.5 text-[11px] font-bold text-forest-700">
            <Users className="h-3 w-3" /> {r.pending_application_count}
          </span>
        ) : (
          <span className="text-ink-light">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      mobile: 'meta',
      cell: (r) => <ListingStatusBadge status={r.listing_status} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (_r) => (
        <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-forest-600">
          Edit <ArrowRight className="h-3.5 w-3.5" />
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
          { label: 'Listings' },
        ]}
        title="Listings"
        description={
          rows.length === 0
            ? 'Publish a room to /listings, review applicants, accept the right tenant. Free on every tier.'
            : `${live.length} active listing${live.length === 1 ? '' : 's'} · ${vacant} vacant room${vacant === 1 ? '' : 's'} available${totalApplications > 0 ? ` · ${totalApplications} pending applicant${totalApplications === 1 ? '' : 's'}` : ''}`
        }
        actions={
          <Button asChild>
            <Link href={`/landlord/${slug}/properties`}>
              <Plus className="h-4 w-4" /> New listing
            </Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<DoorOpen className="h-6 w-6" />}
          title="No rooms to list yet"
          description="Add a property and at least one room. Once a room is created you can publish it as a public listing here."
          cta={{ label: 'Add a property', href: `/landlord/${slug}/properties/new` }}
        />
      ) : (
        <>
          <TabBar items={tabs} activeId={tab} />
          <SectionCard padded={false}>
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(r) => r.id}
              rowHref={(r) => `/landlord/${slug}/listings/${r.id}/applications`}
              emptyState={
                <p className="text-[13px] text-ink-light">No listings match this filter.</p>
              }
              className="border-0 lg:rounded-none lg:border-0"
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}

function formatAvailableFrom(iso: string | null): string {
  if (!iso) return 'Now';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Now';
  if (date.getTime() <= Date.now()) return 'Now';
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function tabHref(slug: string, tab: string): string {
  return tab === 'all'
    ? `/landlord/${slug}/listings`
    : `/landlord/${slug}/listings?tab=${encodeURIComponent(tab)}`;
}
