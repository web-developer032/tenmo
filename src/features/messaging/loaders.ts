import 'server-only';
import {
  Conversation,
  type ConversationListItem,
  type ConversationParticipantView,
  Message,
} from '@/core/schemas/messaging';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Server loaders for messaging — used by Server Components to render
 * the inbox + thread without going through the API. Mirrors
 * `features/notifications/loaders.ts`.
 */

export type InboxFeed = {
  conversations: ConversationListItem[];
  unread_total: number;
};

export async function loadInbox(): Promise<InboxFeed> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { conversations: [], unread_total: 0 };

  const { data: rows, error } = await supabase
    .from('conversations')
    .select('id, org_id, kind, tenancy_id, title, created_by, created_at, last_message_at')
    .order('last_message_at', { ascending: false })
    .limit(100);
  if (error) return { conversations: [], unread_total: 0 };

  const conversations = (rows ?? []).map((r) => Conversation.parse(r));

  if (conversations.length === 0) {
    return { conversations: [], unread_total: 0 };
  }

  const ids = conversations.map((c) => c.id);
  const sb = createServiceClient();

  const [{ data: parts }, { data: msgs }, { data: cursors }, { data: unreadTotal }] =
    await Promise.all([
      sb
        .from('conversation_participants')
        .select('conversation_id, user_id, party_role')
        .in('conversation_id', ids)
        .neq('user_id', user.id),
      sb
        .from('messages')
        .select('conversation_id, sender_id, body, created_at, deleted_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })
        .limit(ids.length * 5),
      sb
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .in('conversation_id', ids)
        .eq('user_id', user.id),
      supabase.rpc('unread_messages_count'),
    ]);

  const otherUserIds = Array.from(new Set((parts ?? []).map((p) => p.user_id)));
  const profileById = new Map<string, { full_name: string | null; contact_email: string | null }>();
  if (otherUserIds.length > 0) {
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, full_name, contact_email')
      .in('id', otherUserIds);
    for (const p of profiles ?? []) {
      profileById.set(p.id, { full_name: p.full_name, contact_email: p.contact_email });
    }
  }

  const othersByConv = new Map<string, ConversationListItem['others']>();
  for (const p of parts ?? []) {
    const profile = profileById.get(p.user_id) ?? null;
    const list = othersByConv.get(p.conversation_id) ?? [];
    list.push({
      user_id: p.user_id,
      party_role: p.party_role,
      full_name: profile?.full_name ?? null,
      contact_email: profile?.contact_email ?? null,
    });
    othersByConv.set(p.conversation_id, list);
  }

  const previewByConv = new Map<string, ConversationListItem['preview']>();
  for (const m of msgs ?? []) {
    if (previewByConv.has(m.conversation_id)) continue;
    previewByConv.set(m.conversation_id, {
      sender_id: m.sender_id,
      body: m.deleted_at ? '' : m.body,
      created_at: m.created_at,
      deleted: Boolean(m.deleted_at),
    });
  }

  const cursorByConv = new Map<string, string>();
  for (const c of cursors ?? []) cursorByConv.set(c.conversation_id, c.last_read_at);

  const unreadByConv = new Map<string, number>();
  for (const m of msgs ?? []) {
    if (m.sender_id === user.id) continue;
    const cursor = cursorByConv.get(m.conversation_id);
    if (cursor && new Date(m.created_at) <= new Date(cursor)) continue;
    unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) ?? 0) + 1);
  }

  const items: ConversationListItem[] = conversations.map((conv) => ({
    conversation: conv,
    unread_count: unreadByConv.get(conv.id) ?? 0,
    preview: previewByConv.get(conv.id) ?? null,
    others: othersByConv.get(conv.id) ?? [],
  }));

  return {
    conversations: items,
    unread_total: typeof unreadTotal === 'number' ? unreadTotal : 0,
  };
}

export async function loadThread(conversationId: string, limit = 100): Promise<Message[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at, deleted_at, edited_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((row) => Message.parse(row)).reverse();
}

/**
 * Full participant list for the active conversation — used by the
 * thread renderer to label senders in group chats and compute read-
 * receipt ticks. Includes the caller themselves (with `is_self: true`)
 * so the UI can resolve "is this my message?" without juggling extra
 * props.
 *
 * RLS: `participants_select_self_or_coparticipant` lets co-participants
 * see each other's rows; the service client is used here only to merge
 * the `profiles` snippet (full_name) — RLS would block reading other
 * users' profile rows.
 */
export async function loadConversationParticipants(
  conversationId: string,
): Promise<ConversationParticipantView[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: parts, error } = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id, party_role, last_read_at')
    .eq('conversation_id', conversationId);
  if (error || !parts || parts.length === 0) return [];

  const ids = Array.from(new Set(parts.map((p) => p.user_id)));
  const sb = createServiceClient();
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, full_name, contact_email')
    .in('id', ids);
  const profileById = new Map<string, { full_name: string | null; contact_email: string | null }>();
  for (const p of profiles ?? []) {
    profileById.set(p.id, { full_name: p.full_name, contact_email: p.contact_email });
  }

  return parts.map((p) => {
    const profile = profileById.get(p.user_id) ?? null;
    return {
      user_id: p.user_id,
      full_name: profile?.full_name ?? null,
      contact_email: profile?.contact_email ?? null,
      party_role: p.party_role,
      last_read_at: p.last_read_at,
      is_self: p.user_id === user.id,
    };
  });
}

export async function loadUnreadMessagesCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data, error } = await supabase.rpc('unread_messages_count');
  if (error) return 0;
  return typeof data === 'number' ? data : 0;
}
