import 'server-only';
import { Conversation, type ConversationListItem } from '@/core/schemas/messaging';
import { DbError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * List the caller's conversations across all orgs they belong to,
 * newest activity first. The returned shape includes everything the
 * inbox UI needs in one round-trip:
 *   * the conversation row
 *   * unread count (server-computed, RLS-safe)
 *   * the latest message preview (sender, body, timestamp, deleted flag)
 *   * the other participants' display names + roles
 *
 * RLS guarantees the SELECT only returns conversations the caller is a
 * participant of (or org-staff for); the per-row enrichments use the
 * service client to avoid N×M RLS round-trips.
 */
export async function listConversationsForUser(
  ctx: HandlerContext,
): Promise<ConversationListItem[]> {
  const user = requireUser(ctx);

  const { data: rows, error } = await ctx.supabase
    .from('conversations')
    .select('id, org_id, kind, tenancy_id, title, created_by, created_at, last_message_at')
    .order('last_message_at', { ascending: false })
    .limit(100);
  if (error) throw new DbError(error);

  const conversations = (rows ?? []).map((r) => Conversation.parse(r));
  if (conversations.length === 0) return [];

  const ids = conversations.map((c) => c.id);
  const sb = createServiceClient();

  const [participants, previews, unread] = await Promise.all([
    fetchOtherParticipants(sb, ids, user.id),
    fetchPreviews(sb, ids),
    fetchUnreadByConversation(sb, user.id, ids),
  ]);

  return conversations.map((conv) => ({
    conversation: conv,
    unread_count: unread.get(conv.id) ?? 0,
    preview: previews.get(conv.id) ?? null,
    others: participants.get(conv.id) ?? [],
  }));
}

type ParticipantSnippet = ConversationListItem['others'][number];

async function fetchOtherParticipants(
  sb: ReturnType<typeof createServiceClient>,
  conversationIds: string[],
  selfId: string,
): Promise<Map<string, ParticipantSnippet[]>> {
  const { data: parts, error } = await sb
    .from('conversation_participants')
    .select('conversation_id, user_id, party_role')
    .in('conversation_id', conversationIds)
    .neq('user_id', selfId);
  if (error) throw new DbError(error);

  const userIds = Array.from(new Set((parts ?? []).map((p) => p.user_id)));
  const profileById = new Map<string, { full_name: string | null; contact_email: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles, error: pErr } = await sb
      .from('profiles')
      .select('id, full_name, contact_email')
      .in('id', userIds);
    if (pErr) throw new DbError(pErr);
    for (const p of profiles ?? []) {
      profileById.set(p.id, { full_name: p.full_name, contact_email: p.contact_email });
    }
  }

  const out = new Map<string, ParticipantSnippet[]>();
  for (const row of parts ?? []) {
    const profile = profileById.get(row.user_id) ?? null;
    const list = out.get(row.conversation_id) ?? [];
    list.push({
      user_id: row.user_id,
      party_role: row.party_role,
      full_name: profile?.full_name ?? null,
      contact_email: profile?.contact_email ?? null,
    });
    out.set(row.conversation_id, list);
  }
  return out;
}

type Preview = NonNullable<ConversationListItem['preview']>;

async function fetchPreviews(
  sb: ReturnType<typeof createServiceClient>,
  conversationIds: string[],
): Promise<Map<string, Preview>> {
  // Pull the latest message per conversation. We do a single query and
  // bucket client-side rather than N round-trips; for an inbox of <= 100
  // conversations this is comfortably under the row-cap.
  const { data, error } = await sb
    .from('messages')
    .select('conversation_id, sender_id, body, created_at, deleted_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false })
    .limit(conversationIds.length * 5);
  if (error) throw new DbError(error);

  const out = new Map<string, Preview>();
  for (const row of data ?? []) {
    if (out.has(row.conversation_id)) continue;
    out.set(row.conversation_id, {
      sender_id: row.sender_id,
      body: row.deleted_at ? '' : row.body,
      created_at: row.created_at,
      deleted: Boolean(row.deleted_at),
    });
  }
  return out;
}

async function fetchUnreadByConversation(
  sb: ReturnType<typeof createServiceClient>,
  userId: string,
  conversationIds: string[],
): Promise<Map<string, number>> {
  const { data: cursors, error } = await sb
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .in('conversation_id', conversationIds)
    .eq('user_id', userId);
  if (error) throw new DbError(error);

  const cursorByConv = new Map<string, string>();
  for (const c of cursors ?? []) cursorByConv.set(c.conversation_id, c.last_read_at);

  const { data: messages, error: msgErr } = await sb
    .from('messages')
    .select('conversation_id, sender_id, created_at')
    .in('conversation_id', conversationIds)
    .neq('sender_id', userId);
  if (msgErr) throw new DbError(msgErr);

  const out = new Map<string, number>();
  for (const m of messages ?? []) {
    const cursor = cursorByConv.get(m.conversation_id);
    if (cursor && new Date(m.created_at) <= new Date(cursor)) continue;
    out.set(m.conversation_id, (out.get(m.conversation_id) ?? 0) + 1);
  }
  return out;
}
