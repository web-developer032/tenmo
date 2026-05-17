import { LISTING_SEARCH_MAX_PAGE_SIZE, LISTING_SEARCH_PAGE_SIZE } from '../constants/listings';
import type { ListingFilters } from '../schemas/listing';

/**
 * Pure helpers for the public listings search.
 *
 * Kept separate from the Zod schema (which validates the wire shape) so
 * the math is unit-testable without pulling in zod or the rest of the
 * request layer.
 */

/**
 * Server-side parameters passed straight into the
 * `public.search_published_listings` RPC.
 */
export interface SearchListingsRpcArgs {
  p_city: string | null;
  p_postcode_prefix: string | null;
  p_min_rent_pence: number | null;
  p_max_rent_pence: number | null;
  p_property_type: string | null;
  p_has_ensuite: boolean | null;
  p_available_from: string | null;
  p_limit: number;
  p_offset: number;
}

/** Clamp a page number to a positive integer (1-based, defaults to 1). */
export function clampPage(page: number | null | undefined): number {
  if (typeof page !== 'number' || !Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

/** Clamp `per_page` to `[1, LISTING_SEARCH_MAX_PAGE_SIZE]`. */
export function clampPerPage(perPage: number | null | undefined): number {
  if (typeof perPage !== 'number' || !Number.isFinite(perPage) || perPage < 1) {
    if (perPage === 0 || (typeof perPage === 'number' && perPage < 1)) return 1;
    return LISTING_SEARCH_PAGE_SIZE;
  }
  return Math.min(LISTING_SEARCH_MAX_PAGE_SIZE, Math.floor(perPage));
}

/**
 * Translate a validated `ListingFilters` value into the RPC arg object.
 *
 * Empty strings, undefined, and null collapse to a single `null` value so
 * the underlying SQL function can use a uniform `(p_x is null or x = ...)`
 * pattern.
 *
 * Rent range bounds are auto-swapped if the user inverts them — most likely
 * a UX typo from a slider mis-drag, so swap is friendlier than zero results.
 */
export function buildListingSearchFilters(input: Partial<ListingFilters>): SearchListingsRpcArgs {
  const page = clampPage(input.page);
  const perPage = clampPerPage(input.per_page);

  let minRent = typeof input.min_rent_pence === 'number' ? input.min_rent_pence : null;
  let maxRent = typeof input.max_rent_pence === 'number' ? input.max_rent_pence : null;
  if (minRent !== null && maxRent !== null && minRent > maxRent) {
    [minRent, maxRent] = [maxRent, minRent];
  }

  return {
    p_city: input.city && input.city.trim().length > 0 ? input.city.trim() : null,
    p_postcode_prefix:
      input.postcode_prefix && input.postcode_prefix.trim().length > 0
        ? input.postcode_prefix.trim().toUpperCase()
        : null,
    p_min_rent_pence: minRent,
    p_max_rent_pence: maxRent,
    p_property_type: input.property_type ?? null,
    p_has_ensuite: typeof input.has_ensuite === 'boolean' ? input.has_ensuite : null,
    p_available_from:
      input.available_from && input.available_from.length > 0 ? input.available_from : null,
    p_limit: perPage,
    p_offset: (page - 1) * perPage,
  };
}

/** Total page count for the listings grid. */
export function listingTotalPages(totalRows: number, perPage: number): number {
  if (perPage <= 0) return 0;
  return Math.max(1, Math.ceil(Math.max(0, totalRows) / perPage));
}
