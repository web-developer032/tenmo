import { ListingFilters } from '@/core/schemas/listing';
import { listPublicListings } from '@/features/listings/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/listings — public, paginated + filterable.
 *
 * Anonymous-friendly (no `requireAuth`). The underlying
 * `search_published_listings` SECURITY DEFINER RPC gates the full street
 * address: anonymous viewers see city + outward postcode only.
 *
 * Query params:
 *   ?city=London
 *   ?postcode_prefix=SW1A
 *   ?min_rent_pence=50000
 *   ?max_rent_pence=120000
 *   ?property_type=hmo_small
 *   ?has_ensuite=true
 *   ?available_from=2026-06-01
 *   ?page=1
 *   ?per_page=24
 */
export const GET = handler(async (ctx) => {
  const url = new URL(ctx.req.url);
  const params = Object.fromEntries(url.searchParams.entries()) as Record<string, string>;

  const parsed = ListingFilters.parse({
    city: params.city,
    postcode_prefix: params.postcode_prefix,
    min_rent_pence: params.min_rent_pence ? Number(params.min_rent_pence) : undefined,
    max_rent_pence: params.max_rent_pence ? Number(params.max_rent_pence) : undefined,
    property_type: params.property_type,
    has_ensuite:
      params.has_ensuite === 'true' ? true : params.has_ensuite === 'false' ? false : undefined,
    available_from: params.available_from,
    page: params.page ? Number(params.page) : undefined,
    per_page: params.per_page ? Number(params.per_page) : undefined,
  });

  const result = await listPublicListings(ctx, parsed);
  return Response.json({ data: result });
});
