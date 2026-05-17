import 'server-only';
import { Message, type SendMessageInput } from '@/core/schemas/messaging';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { notifyMessageReceived } from './notify';

/**
 * Persist a new message and fan out a `message_received` notification
 * to every other participant.
 *
 * Authorisation:
 *   * `sender_id = auth.uid()` is enforced by the messages_insert_participant
 *     RLS policy (and the conversation_id participant check).
 *   * If the caller is not a participant, the INSERT fails — we surface
 *     a 403 instead of leaking the row error.
 *
 * Notification fan-out is best-effort and runs after the row is
 * persisted; failures are logged inside `notifyMessageReceived`.
 */
export async function sendMessage(ctx: HandlerContext, input: SendMessageInput): Promise<Message> {
  const user = requireUser(ctx);

  const { data, error } = await ctx.supabase
    .from('messages')
    .insert({
      conversation_id: input.conversation_id,
      sender_id: user.id,
      body: input.body.trim(),
    })
    .select('id, conversation_id, sender_id, body, created_at, deleted_at, edited_at')
    .maybeSingle();
  if (error) {
    if (error.code === '42501' || /row-level security/i.test(error.message)) {
      throw new AppError(403, ErrorCode.forbidden, 'Not a participant of this conversation');
    }
    throw new DbError(error);
  }
  if (!data) {
    throw new AppError(500, ErrorCode.internal_error, 'Insert returned no row');
  }

  const message = Message.parse(data);
  await notifyMessageReceived(message, user.id);
  return message;
}
