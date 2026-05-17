import 'server-only';
import { DbError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';

/**
 * Advance the caller's `last_read_at` cursor for a conversation AND mark
 * any unread `notifications` scoped to that conversation as read.
 *
 * Wraps the `mark_conversation_fully_read` RPC (added in
 * 20260503000000_messaging_realtime_and_receipts) so opening a chat
 * clears both the inbox row badge and the bell badge in one round-trip.
 * Idempotent — the RPC clamps with `greatest()` and skips already-read
 * notifications.
 */
export async function markConversationRead(
  ctx: HandlerContext,
  conversationId: string,
): Promise<string> {
  requireUser(ctx);
  const { data, error } = await ctx.supabase.rpc('mark_conversation_fully_read', {
    p_conversation_id: conversationId,
  });
  if (error) throw new DbError(error);
  return (data as string) ?? new Date().toISOString();
}

export async function unreadMessagesCount(ctx: HandlerContext): Promise<number> {
  requireUser(ctx);
  const { data, error } = await ctx.supabase.rpc('unread_messages_count');
  if (error) throw new DbError(error);
  return Number(data ?? 0);
}
