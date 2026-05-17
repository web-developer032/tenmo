import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LISTING_SEARCH_PAGE_SIZE } from '@/core/constants/listings';
import { type ListingFilters, PublicListing } from '@/core/schemas/listing';
import { buildListingSearchFilters, listingTotalPages } from '@/core/utils/listing-search';
import { DbError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Paginated public listings search.
 *
 * Hits the `public.search_published_listings` SECURITY DEFINER RPC so the
 * caller doesn't need any RLS access on `rooms` / `properties` to browse
 * the public catalogue. The RPC also gates the full street address to
 * authenticated viewers.
 */

export interface ListPublicListingsResult {
  rows: PublicListing[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export async function listPublicListingsWithClient(
  sb: SupabaseClient,
  input: Partial<ListingFilters> = {},
): Promise<ListPublicListingsResult> {
  const args = buildListingSearchFilters(input);
  const { data, error } = await sb.rpc('search_published_listings', args);
  if (error) throw new DbError(error);

  type Row = { total_count: number | string | null } & Record<string, unknown>;
  const rows = (data ?? []) as Row[];
  const total = rows.length === 0 ? 0 : Number(rows[0]?.total_count ?? 0);
  const perPage = args.p_limit;
  const page = Math.floor(args.p_offset / perPage) + 1;

  return {
    rows: rows.map((r) => PublicListing.parse(r)),
    total,
    page,
    per_page: perPage,
    total_pages: listingTotalPages(total, perPage),
  };
}

export function listPublicListings(
  ctx: HandlerContext,
  input: Partial<ListingFilters> = {},
): Promise<ListPublicListingsResult> {
  return listPublicListingsWithClient(ctx.supabase, input);
}

export const LIST_PUBLIC_DEFAULT_PAGE_SIZE = LISTING_SEARCH_PAGE_SIZE;
