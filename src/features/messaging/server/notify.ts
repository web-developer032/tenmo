import 'server-only';
import type { Message } from '@/core/schemas/messaging';
import { publishNotification } from '@/features/notifications/server';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * `message_received` notification fan-out.
 *
 * Sends one in-app notification per non-sender participant of the
 * conversation. Email defaults are *off* for this kind (chatty) but
 * the per-user preference still wins — if a user opted in, we let
 * the publisher's email decision through and the future digest can pick
 * it up.
 *
 * Best-effort: failures are logged but never thrown so a flaky logger
 * or DB blip can't roll back the message itself.
 */
const log = () => getLogger().child({ module: 'messaging.notify' });

export async function notifyMessageReceived(message: Message, senderId: string): Promise<void> {
  try {
    const sb = createServiceClient();

    const { data: participants, error: pErr } = await sb
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', message.conversation_id)
      .neq('user_id', senderId);
    if (pErr) {
      log().warn({ err: pErr, messageId: message.id }, 'participant lookup failed');
      return;
    }

    const { data: sender } = await sb
      .from('profiles')
      .select('full_name, contact_email')
      .eq('id', senderId)
      .maybeSingle();

    const senderLabel = sender?.full_name?.trim() || sender?.contact_email || 'Someone';

    const preview = compactPreview(message.body);
    const link = `/messages/${message.conversation_id}`;

    for (const row of participants ?? []) {
      await publishNotification({
        user_id: row.user_id,
        kind: 'message_received',
        title: `New message from ${senderLabel}`,
        body: preview,
        link_url: link,
        entity_type: 'conversation',
        entity_id: message.conversation_id,
        meta: { message_id: message.id, sender_id: senderId },
      });
    }
  } catch (err) {
    log().warn({ err, messageId: message.id }, 'message notify fan-out failed');
  }
}

function compactPreview(body: string): string {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= 140) return oneLine;
  return `${oneLine.slice(0, 137)}…`;
}
