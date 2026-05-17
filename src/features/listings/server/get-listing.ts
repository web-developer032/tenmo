import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PublicListing } from '@/core/schemas/listing';
import { DbError, NotFoundError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Fetch a single published listing — public-safe.
 *
 * Returns null if the room is not published (rather than 404 from the RPC)
 * so the caller can decide whether to render a "no longer available" page.
 */
export async function getPublicListingWithClient(
  sb: SupabaseClient,
  roomId: string,
): Promise<PublicListing | null> {
  const { data, error } = await sb.rpc('get_published_listing', { p_room_id: roomId });
  if (error) throw new DbError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return PublicListing.parse(row);
}

export async function getPublicListingOrThrow(
  ctx: HandlerContext,
  roomId: string,
): Promise<PublicListing> {
  const found = await getPublicListingWithClient(ctx.supabase, roomId);
  if (!found) throw new NotFoundError('Listing not found or no longer available');
  return found;
}
