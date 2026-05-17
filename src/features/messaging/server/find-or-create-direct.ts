import 'server-only';
import type { FindOrCreateDirectInput } from '@/core/schemas/messaging';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';

/**
 * Idempotently find-or-create a 1-1 direct conversation between the
 * caller and another user inside a shared org.
 *
 * The actual authorisation logic (caller must be in the org, other user
 * must have *some* relationship to the org) lives in the
 * `find_or_create_direct_conversation` RPC. This wrapper just normalises
 * error mapping so the API layer doesn't have to.
 */
export async function findOrCreateDirectConversation(
  ctx: HandlerContext,
  input: FindOrCreateDirectInput,
): Promise<string> {
  requireUser(ctx);
  const { data, error } = await ctx.supabase.rpc('find_or_create_direct_conversation', {
    p_org_id: input.org_id,
    p_other_user_id: input.other_user_id,
  });
  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('not a member of org')) {
      throw new AppError(403, ErrorCode.not_org_member, 'Not a member of this org');
    }
    if (msg.includes('no relationship')) {
      throw new AppError(403, ErrorCode.forbidden, 'Cannot start a conversation with this user');
    }
    if (msg.includes('with yourself')) {
      throw new AppError(400, ErrorCode.bad_request, 'Cannot message yourself');
    }
    throw new DbError(error);
  }
  if (!data) throw new DbError(new Error('RPC returned no id'));
  return data as string;
}
