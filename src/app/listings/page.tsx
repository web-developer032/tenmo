import { Search } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
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
    <main className="min-h-dvh bg-bg-page">
      <header className="border-b border-border-soft bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 lg:px-6 lg:py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-sans text-[15px] font-extrabold tracking-tight text-ink"
          >
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] bg-forest-600 text-white"
              aria-hidden
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
              >
                <title>Tenantly logo</title>
                <path d="M3 11l9-8 9 8" />
                <path d="M5 10v10h14V10" />
                <path d="M10 20v-6h4v6" />
              </svg>
            </span>
            Tenantly
          </Link>
          <nav className="flex items-center gap-1.5">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Create account</Link>
            </Button>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 lg:space-y-6 lg:px-6 lg:py-8">
        <PageHeader
          title="Find your next room"
          description="Tenant-friendly rooms from compliant Tenantly landlords. Tenancies are free for tenants — forever."
        />

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
            <p className="text-[12px] text-ink-light">
              {total === 1 ? '1 room' : `${total} rooms`} · Showing page {page} of {total_pages}
            </p>
            <ResponsiveGrid preset="listings">
              {rows.map((listing) => (
                <ListingCard key={listing.room_id} listing={listing} />
              ))}
            </ResponsiveGrid>
            <ListingsPagination page={page} totalPages={total_pages} perPage={per_page} sp={sp} />
          </>
        )}
      </div>
    </main>
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
      <span className="text-[12px] text-ink-light">
        Page {page} of {totalPages}
      </span>
      <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
        <a href={page < totalPages ? urlFor(page + 1) : '#'}>Next</a>
      </Button>
    </nav>
  );
}
