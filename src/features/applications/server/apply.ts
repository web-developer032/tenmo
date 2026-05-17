import 'server-only';
import { Application, type ApplicationCreate } from '@/core/schemas/application';
import { BusinessRuleError, ConflictError, DbError, NotFoundError } from '@/lib/errors';
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

  // Up-front validation — the RLS branch on INSERT also checks this, but a
  // friendly 422 is nicer than the generic 42501 / 23514 mess.
  const { data: room, error: roomErr } = await ctx.supabase
    .from('rooms')
    .select('id, listing_status, archived_at')
    .eq('id', roomId)
    .maybeSingle();
  if (roomErr) throw new DbError(roomErr);
  if (!room) throw new NotFoundError('Listing not found');
  if (room.archived_at) {
    throw new BusinessRuleError('This room is no longer available');
  }
  if (room.listing_status !== 'published') {
    throw new BusinessRuleError('This room is not currently accepting applications');
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
