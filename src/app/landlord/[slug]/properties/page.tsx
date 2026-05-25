import { ArrowRight, Building2, Plus } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { AvRow } from '@/components/ds/av-row';
import { type Column, DataTable } from '@/components/ds/data-table';
import { PageHeader } from '@/components/ds/page-header';
import { SectionCard } from '@/components/ds/section-card';
import { TabBar, type TabItem } from '@/components/ds/tab-bar';
import { Button } from '@/components/ui/button';
import { formatMoneyShort } from '@/core/utils/money';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };
type Search = { tab?: string };

type PropertyAddress = { line1?: string; city?: string; postcode?: string };

type PropertyRow = {
  id: string;
  name: string;
  type: string | null;
  isHmo: boolean;
  city: string | null;
  postcode: string | null;
  totalRooms: number;
  occupiedRooms: number;
  monthlyRentPence: number;
  openTickets: number;
  expiringCompliance: number;
};

export default async function PropertiesListPage({
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

  const [propertiesResp, roomsResp, tenanciesResp, ticketsResp, complianceResp] = await Promise.all(
    [
      supabase
        .from('properties')
        .select('id, name, type, address, is_hmo')
        .eq('org_id', org.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('rooms')
        .select('id, property_id, status')
        .eq('org_id', org.id)
        .is('archived_at', null),
      supabase
        .from('tenancies')
        .select('property_id, rent_pence')
        .eq('org_id', org.id)
        .eq('status', 'active'),
      supabase
        .from('tickets')
        .select('property_id')
        .eq('org_id', org.id)
        .in('status', ['open', 'in_progress']),
      supabase
        .from('compliance_items')
        .select('property_id, status')
        .eq('org_id', org.id)
        .in('status', ['due_soon', 'overdue']),
    ],
  );

  const properties = propertiesResp.data ?? [];
  const rooms = roomsResp.data ?? [];
  const tenancies = tenanciesResp.data ?? [];
  const tickets = ticketsResp.data ?? [];
  const compliance = complianceResp.data ?? [];

  const rows: PropertyRow[] = properties.map((p) => {
    const addr = (p.address as PropertyAddress | null) ?? null;
    const propertyRooms = rooms.filter((r) => r.property_id === p.id);
    const occupied = propertyRooms.filter((r) => r.status === 'occupied').length;
    const monthly = tenancies
      .filter((t) => t.property_id === p.id)
      .reduce((sum, t) => sum + (t.rent_pence ?? 0), 0);
    const propTickets = tickets.filter((t) => t.property_id === p.id).length;
    const propCompliance = compliance.filter((c) => c.property_id === p.id).length;
    return {
      id: p.id as string,
      name: (p.name as string) ?? 'Property',
      type: (p.type as string | null) ?? null,
      isHmo: !!p.is_hmo,
      city: addr?.city ?? null,
      postcode: addr?.postcode ?? null,
      totalRooms: propertyRooms.length,
      occupiedRooms: occupied,
      monthlyRentPence: monthly,
      openTickets: propTickets,
      expiringCompliance: propCompliance,
    };
  });

  const cities = Array.from(new Set(rows.map((r) => r.city).filter(Boolean))) as string[];
  const issuesCount = rows.filter((r) => r.openTickets > 0 || r.expiringCompliance > 0).length;

  const tabs: TabItem[] = [
    { id: 'all', label: 'All', count: rows.length, href: tabHref(slug, 'all') },
    ...cities.map((c) => ({
      id: slugifyCity(c),
      label: c,
      count: rows.filter((r) => r.city === c).length,
      href: tabHref(slug, slugifyCity(c)),
    })),
    {
      id: 'issues',
      label: 'Issues only',
      count: issuesCount,
      href: tabHref(slug, 'issues'),
    },
  ];

  const filtered = rows.filter((r) => {
    if (tab === 'all') return true;
    if (tab === 'issues') return r.openTickets > 0 || r.expiringCompliance > 0;
    return slugifyCity(r.city) === tab;
  });

  const columns: Column<PropertyRow>[] = [
    {
      id: 'property',
      header: 'Property',
      mobile: 'primary',
      cell: (r) => (
        <AvRow
          name={r.name}
          sub={[r.type ? r.type.replace(/_/g, ' ') : null, r.isHmo ? 'HMO' : null]
            .filter(Boolean)
            .join(' · ')}
          size="sm"
        />
      ),
    },
    {
      id: 'location',
      header: 'Location',
      cell: (r) => (
        <span className="text-ink">{[r.city, r.postcode].filter(Boolean).join(' ') || '—'}</span>
      ),
    },
    {
      id: 'rooms',
      header: 'Rooms',
      align: 'right',
      cell: (r) => r.totalRooms,
    },
    {
      id: 'occupancy',
      header: 'Occupancy',
      mobile: 'secondary',
      cell: (r) => <OccupancyBar occupied={r.occupiedRooms} total={r.totalRooms} />,
    },
    {
      id: 'rent',
      header: 'Monthly rent',
      align: 'right',
      mobile: 'meta',
      cell: (r) => (
        <span className="font-semibold text-forest-700">
          {formatMoneyShort(r.monthlyRentPence)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => <PropertyStatusPill row={r} />,
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
          { label: 'Properties' },
        ]}
        title="Properties"
        description={
          rows.length === 0
            ? 'Add your first property to start tracking rooms, tenancies and compliance.'
            : `${rows.length} ${rows.length === 1 ? 'property' : 'properties'} · ${rooms.length} rooms total`
        }
        actions={
          <Button asChild>
            <Link href={`/landlord/${slug}/properties/new`}>
              <Plus className="h-4 w-4" /> Add property
            </Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No properties yet"
          description="Add your first property to start tracking rooms, tenancies and compliance."
          cta={{ label: 'Add property', href: `/landlord/${slug}/properties/new` }}
        />
      ) : (
        <>
          <TabBar items={tabs} activeId={tab} />
          <SectionCard padded={false}>
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(r) => r.id}
              rowHref={(r) => `/landlord/${slug}/properties/${r.id}`}
              emptyState={
                <p className="text-[13px] text-ink-light">No properties match this filter.</p>
              }
              className="border-0 lg:rounded-none lg:border-0"
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}

function PropertyStatusPill({ row }: { row: PropertyRow }) {
  if (row.openTickets > 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-alert-bg px-2.5 py-0.5 text-[11px] font-bold text-alert">
        {row.openTickets} {row.openTickets === 1 ? 'issue' : 'issues'}
      </span>
    );
  }
  if (row.expiringCompliance > 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-bg px-2.5 py-0.5 text-[11px] font-bold text-amber">
        Cert due
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-foam px-2.5 py-0.5 text-[11px] font-bold text-forest-700">
      All clear
    </span>
  );
}

function OccupancyBar({ occupied, total }: { occupied: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((occupied / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-page">
        <div
          className={cn(
            'h-full rounded-full',
            pct >= 100
              ? 'bg-forest-500'
              : pct >= 60
                ? 'bg-forest-500'
                : pct > 0
                  ? 'bg-amber'
                  : 'bg-border-soft',
          )}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <span className="text-[12px] font-semibold text-ink">
        {occupied}/{total}
      </span>
    </div>
  );
}

function slugifyCity(city: string | null): string {
  return (
    (city ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'unknown'
  );
}

function tabHref(slug: string, tab: string): string {
  return tab === 'all'
    ? `/landlord/${slug}/properties`
    : `/landlord/${slug}/properties?tab=${encodeURIComponent(tab)}`;
}
