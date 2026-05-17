import { Search } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { ListingFilters } from '@/core/schemas/listing';
import { ListingCard } from '@/features/listings/components/listing-card';
import { ListingsFiltersForm } from '@/features/listings/components/listings-filters-form';
import { listPublicListingsWithClient } from '@/features/listings/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Public listings search page — anonymous-friendly.
 *
 * Mounted at `/listings`. Anyone can browse rooms by city + postcode prefix
 * + rent range; signing up is only required to apply.
 */
export default async function PublicListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const filters = ListingFilters.parse({
    city: sp.city,
    postcode_prefix: sp.postcode_prefix,
    min_rent_pence: sp.min_rent_pence ? Number(sp.min_rent_pence) : undefined,
    max_rent_pence: sp.max_rent_pence ? Number(sp.max_rent_pence) : undefined,
    property_type: sp.property_type,
    has_ensuite: sp.has_ensuite === 'true' ? true : undefined,
    available_from: sp.available_from,
    page: sp.page ? Number(sp.page) : undefined,
    per_page: sp.per_page ? Number(sp.per_page) : undefined,
  });

  const supabase = await createClient();
  const { rows, total, page, per_page, total_pages } = await listPublicListingsWithClient(
    supabase,
    filters,
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Find your next room</h1>
        <p className="text-sm text-muted-foreground">
          Tenant-friendly rooms from compliant Tenantly landlords. Tenancies are free for tenants —
          forever.
        </p>
      </header>

      <ListingsFiltersForm />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="No rooms match those filters"
          description="Try widening the postcode prefix or removing some filters. New rooms list every week."
          cta={{ label: 'Clear filters', href: '/listings' }}
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {total === 1 ? '1 room' : `${total} rooms`} · Showing page {page} of {total_pages}
          </p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((listing) => (
              <li key={listing.room_id}>
                <ListingCard listing={listing} />
              </li>
            ))}
          </ul>
          <ListingsPagination page={page} totalPages={total_pages} perPage={per_page} sp={sp} />
        </>
      )}
    </div>
  );
}

function ListingsPagination({
  page,
  totalPages,
  perPage,
  sp,
}: {
  page: number;
  totalPages: number;
  perPage: number;
  sp: Record<string, string>;
}) {
  if (totalPages <= 1) return null;
  function urlFor(p: number) {
    const usp = new URLSearchParams(sp);
    usp.set('page', String(p));
    usp.set('per_page', String(perPage));
    return `/listings?${usp.toString()}`;
  }
  return (
    <nav className="flex items-center justify-between gap-2 pt-2" aria-label="Listings pagination">
      <Button asChild variant="outline" size="sm" disabled={page <= 1}>
        <a href={page > 1 ? urlFor(page - 1) : '#'}>Previous</a>
      </Button>
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
        <a href={page < totalPages ? urlFor(page + 1) : '#'}>Next</a>
      </Button>
    </nav>
  );
}
