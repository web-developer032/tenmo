import { DoorOpen, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
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
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Listings</h1>
          <p className="text-sm text-muted-foreground">
            Publish a room to /listings, review applicants, accept the right tenant. Free on every
            tier — listings are how Tenantly grows.
          </p>
        </div>
      </header>

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
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-base">
                          {row.name}{' '}
                          <span className="text-sm font-normal text-muted-foreground">
                            · {row.property_name}
                          </span>
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {rent}
                          {row.has_ensuite ? ' · Ensuite' : ''}
                          {row.property_city ? ` · ${row.property_city}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ListingStatusBadge status={row.listing_status} />
                        <Link
                          href={`/landlord/${slug}/listings/${row.id}/applications`}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
                        >
                          <Users className="h-3 w-3" />
                          {row.pending_application_count} pending
                        </Link>
                      </div>
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
