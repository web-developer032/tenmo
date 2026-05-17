import { getPublicListingOrThrow } from '@/features/listings/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/listings/[roomId] — public single-listing detail.
 *
 * 404s if the listing isn't currently published. Anonymous viewers get city
 * + outward postcode; signed-in viewers get the full street address.
 */
export const GET = handler<{ roomId: string }>(async (ctx, { roomId }) => {
  const listing = await getPublicListingOrThrow(ctx, roomId);
  return Response.json({ data: listing });
});
