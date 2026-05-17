import 'server-only';
import type { ListingPublishInput } from '@/core/schemas/listing';
import { AppError, BusinessRuleError, DbError, ErrorCode, NotFoundError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';

/**
 * Landlord-side listing transitions: publish / pause / close.
 *
 * Tier-gating note: at MVP the discovery feature is intentionally available
 * on the Free tier — every landlord can list — so we don't call
 * `assertTierFeature` here. The tier gate is reserved for v1.1 features
 * like featured / promoted listings (see plan, Out of scope).
 *
 * RLS already restricts UPDATE on rooms to landlord roles in the org, so we
 * lean on that rather than re-checking org membership here. The functions
 * below load the row first so the API can return a 404 for cross-org guesses
 * without leaking row existence to non-members.
 */

export interface ListingRow {
  id: string;
  org_id: string;
  property_id: string;
  status: string;
  archived_at: string | null;
  listing_status: 'draft' | 'published' | 'paused' | 'closed';
  listing_published_at: string | null;
  listing_description: string | null;
  listing_available_from: string | null;
  listing_min_term_months: number | null;
  listing_bills_included: boolean;
}

const LISTING_COLUMNS =
  'id, org_id, property_id, status, archived_at, listing_status, listing_published_at, listing_description, listing_available_from, listing_min_term_months, listing_bills_included';

async function loadRoom(ctx: HandlerContext, roomId: string): Promise<ListingRow> {
  const { data, error } = await ctx.supabase
    .from('rooms')
    .select(LISTING_COLUMNS)
    .eq('id', roomId)
    .maybeSingle();
  if (error) throw new DbError(error);
  if (!data) throw new NotFoundError('Room not found');
  return data as ListingRow;
}

async function updateListing(
  ctx: HandlerContext,
  roomId: string,
  patch: Partial<{
    listing_status: ListingRow['listing_status'];
    listing_description: string | null;
    listing_available_from: string | null;
    listing_min_term_months: number | null;
    listing_bills_included: boolean;
    listing_published_at: string | null;
  }>,
): Promise<ListingRow> {
  const { data, error } = await ctx.supabase
    .from('rooms')
    .update(patch)
    .eq('id', roomId)
    .select(LISTING_COLUMNS)
    .single();
  if (error) {
    if (error.code === '42501') {
      throw new AppError(403, ErrorCode.forbidden, 'You cannot edit listings for this room');
    }
    throw new DbError(error);
  }
  return data as ListingRow;
}

/**
 * Publish (or update + publish) a listing for a room.
 *
 * Refuses to publish:
 *  - archived rooms
 *  - rooms with `status = 'occupied'` (use `manage-listing → republish` workflow once vacant)
 *  - rooms with `listing_status = 'closed'` — closed is terminal for that
 *    listing campaign; we re-open by transitioning through `draft` first via
 *    the dedicated `republishListing` helper below.
 */
export async function publishListing(
  ctx: HandlerContext,
  roomId: string,
  input: ListingPublishInput,
): Promise<ListingRow> {
  requireUser(ctx);
  const room = await loadRoom(ctx, roomId);
  if (room.archived_at) {
    throw new BusinessRuleError('Cannot list an archived room');
  }
  if (room.status === 'occupied') {
    throw new BusinessRuleError('Cannot list an occupied room — end the active tenancy first');
  }
  if (room.listing_status === 'closed') {
    throw new BusinessRuleError(
      'This listing is closed. Re-open it from the listings manager before publishing.',
    );
  }

  return updateListing(ctx, roomId, {
    listing_status: 'published',
    listing_description: input.listing_description ?? null,
    listing_available_from: input.listing_available_from ?? null,
    listing_min_term_months: input.listing_min_term_months ?? null,
    listing_bills_included: input.listing_bills_included,
    // listing_published_at is auto-stamped by the trigger.
  });
}

/** Pause a published listing. Anonymous browsers stop seeing it. */
export async function pauseListing(ctx: HandlerContext, roomId: string): Promise<ListingRow> {
  requireUser(ctx);
  const room = await loadRoom(ctx, roomId);
  if (room.listing_status !== 'published') {
    throw new BusinessRuleError('Only published listings can be paused');
  }
  return updateListing(ctx, roomId, { listing_status: 'paused' });
}

/** Resume a paused listing — back to published. */
export async function resumeListing(ctx: HandlerContext, roomId: string): Promise<ListingRow> {
  requireUser(ctx);
  const room = await loadRoom(ctx, roomId);
  if (room.listing_status !== 'paused') {
    throw new BusinessRuleError('Only paused listings can be resumed');
  }
  return updateListing(ctx, roomId, { listing_status: 'published' });
}

/** Close a listing — terminal. Use this when you fill the room outside Tenantly. */
export async function closeListing(ctx: HandlerContext, roomId: string): Promise<ListingRow> {
  requireUser(ctx);
  const room = await loadRoom(ctx, roomId);
  if (room.listing_status === 'closed') {
    return room;
  }
  return updateListing(ctx, roomId, { listing_status: 'closed' });
}

/**
 * Re-open a closed listing back to draft. The landlord then goes through
 * `publishListing` to expose it again.
 */
export async function reopenListing(ctx: HandlerContext, roomId: string): Promise<ListingRow> {
  requireUser(ctx);
  const room = await loadRoom(ctx, roomId);
  if (room.listing_status !== 'closed') {
    throw new BusinessRuleError('Only closed listings can be re-opened');
  }
  return updateListing(ctx, roomId, {
    listing_status: 'draft',
    listing_published_at: null,
  });
}

export { loadRoom as loadListingRow };
