import { DoorOpen, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/ds/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/core/utils/money';
import { ListingActions } from '@/features/listings/components/listing-actions';
import { ListingStatusBadge } from '@/features/listings/components/listing-status-badge';
import { loadLandlordListings } from '@/features/listings/loaders';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Params = { slug: string };

export default async function LandlordListingsPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: org } = await supabase.from('orgs').select('id').eq('slug', slug).maybeSingle();
  if (!org) notFound();

  const rows = await loadLandlordListings(org.id);

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Listings' },
        ]}
        title="Listings"
        description="Publish a room to /listings, review applicants, accept the right tenant. Free on every tier — listings are how Tenantly grows."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<DoorOpen className="h-6 w-6" />}
          title="No rooms to list yet"
          description="Add a property and at least one room. Once a room is created you can publish it as a public listing here."
          cta={{ label: 'Add a property', href: `/landlord/${slug}/properties/new` }}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const rent = row.default_rent_pence
              ? `${formatMoney(row.default_rent_pence)}${row.default_rent_frequency === 'weekly' ? ' / wk' : ' / mo'}`
              : '—';
            return (
              <li key={row.id}>
                <Card>
                  <CardHeader className="flex-col items-stretch gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle>
                        {row.name}{' '}
                        <span className="text-[12.5px] font-medium text-ink-light">
                          · {row.property_name}
                        </span>
                      </CardTitle>
                      <p className="text-[12px] text-ink-light">
                        {rent}
                        {row.has_ensuite ? ' · Ensuite' : ''}
                        {row.property_city ? ` · ${row.property_city}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ListingStatusBadge status={row.listing_status} />
                      <Link
                        href={`/landlord/${slug}/listings/${row.id}/applications`}
                        className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-mid transition-colors hover:border-forest-200 hover:text-forest-600"
                      >
                        <Users className="h-3 w-3" />
                        {row.pending_application_count} pending
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ListingActions row={row} orgSlug={slug} />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
