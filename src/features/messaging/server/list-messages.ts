import 'server-only';
import { type ListMessagesQuery, Message } from '@/core/schemas/messaging';
import { DbError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';

/**
 * Page of messages for a conversation, newest-first.
 *
 * RLS confirms the caller is a participant; if not, the result set is
 * empty (we never 404 here — the inbox UI just renders an empty thread).
 *
 * Pagination is keyset on `created_at` (`before` cursor). We sort
 * descending in the query then reverse before returning so the UI can
 * append-only into a chronologically ordered list.
 */
export async function listMessages(
  ctx: HandlerContext,
  query: ListMessagesQuery,
): Promise<Message[]> {
  requireUser(ctx);

  let q = ctx.supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at, deleted_at, edited_at')
    .eq('conversation_id', query.conversation_id)
    .order('created_at', { ascending: false })
    .limit(query.limit);
  if (query.before) q = q.lt('created_at', query.before);

  const { data, error } = await q;
  if (error) throw new DbError(error);

  return (data ?? []).map((row) => Message.parse(row)).reverse();
}
