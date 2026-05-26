import 'server-only';
import { Application, type ApplicationCreate } from '@/core/schemas/application';
import { ConflictError, DbError, NotFoundError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { notifyApplicationReceived } from './notifications';

/**
 * Tenant-side application submission.
 *
 * Validates the room is currently published, then inserts a `room_applications`
 * row scoped to `auth.uid()`. RLS enforces both — this code does an explicit
 * check up front purely so we can return a friendly 422 instead of a generic
 * "policy violation" error.
 *
 * Notifications fan-out to the landlord roles is fire-and-forget.
 */
export async function applyToListing(
  ctx: HandlerContext,
  roomId: string,
  input: ApplicationCreate,
): Promise<Application> {
  const user = requireUser(ctx);

  // Up-front validation — uses the public SECURITY DEFINER RPC because a
  // prospective tenant has no direct RLS read on `rooms` (only org members
  // and existing tenants do). The RPC returns a row iff the listing is
  // currently `published` and not archived, so a missing row legitimately
  // means "not findable / not accepting applications".
  const { data: listingRows, error: roomErr } = await ctx.supabase.rpc('get_published_listing', {
    p_room_id: roomId,
  });
  if (roomErr) throw new DbError(roomErr);
  const listing = Array.isArray(listingRows) ? listingRows[0] : listingRows;
  if (!listing) {
    throw new NotFoundError('Listing not found or not currently accepting applications');
  }

  const { data, error } = await ctx.supabase
    .from('room_applications')
    .insert({
      room_id: roomId,
      applicant_user_id: user.id,
      message: input.message ?? null,
    })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new ConflictError(undefined, 'You already have a pending application for this room');
    }
    throw new DbError(error);
  }

  const parsed = Application.parse(data);
  notifyApplicationReceived(parsed.id).catch((err) => {
    ctx.log.warn({ err, applicationId: parsed.id }, 'notifyApplicationReceived failed');
  });
  return parsed;
}
