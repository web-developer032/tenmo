'use client';

import * as React from 'react';
import { type ConversationParticipantView, Message } from '@/core/schemas/messaging';
import { createClient } from '@/lib/supabase/client';
import { freshRealtimeChannel } from '@/lib/supabase/realtime';
import {
  fetchConversationParticipants,
  fetchMessages,
  markConversationReadApi,
  sendMessageApi,
} from '../api/client';
import { dispatchMessagingRead } from '../events';

/**
 * Live thread view for a single conversation.
 *
 * Responsibilities:
 *   * Initial fetch of the latest page of messages.
 *   * Realtime subscription on `public.messages` filtered by
 *     `conversation_id` — INSERT appends, UPDATE patches in place
 *     (covers soft-delete + edits).
 *   * Realtime subscription on `public.conversation_participants`
 *     (filtered by conversation_id) so other people's `last_read_at`
 *     advances immediately update the read-receipt ticks on our
 *     bubbles.
 *   * Optimistic send with rollback on failure.
 *   * Mark-as-read on mount, on every inbound message, and on tab
 *     refocus. Each mark-read also fires a same-tab `messaging:read`
 *     event so the inbox / bell can refresh without waiting for
 *     realtime.
 *   * Typing indicators via Supabase Realtime *broadcast* (no DB
 *     writes). Calls to `notifyTyping()` from the composer broadcast
 *     once per 2 s while the user is typing; remote typers expire from
 *     local state 4 s after their last broadcast.
 */
export type UseConversationOptions = {
  conversationId: string;
  /** Caller's user id — drives "is this my message?" + read receipts. */
  selfId: string;
  /** Caller's display name — included in typing broadcasts so the
   *  receiver can render "Sara is typing…" without an extra round-trip. */
  selfName?: string | null;
  /** Server-rendered participants snapshot (avoids the empty-flash). */
  initialParticipants?: ConversationParticipantView[];
};

export type OptimisticMessage = Message & {
  __pending?: boolean;
  __failed?: boolean;
};

/** A remote participant currently typing — name + when their broadcast expires. */
export type TypingParticipant = {
  userId: string;
  fullName: string;
  expiresAt: number;
};

const TYPING_EXPIRY_MS = 4000;
const TYPING_BROADCAST_THROTTLE_MS = 2000;

export function useConversation({
  conversationId,
  selfId,
  selfName,
  initialParticipants,
}: UseConversationOptions) {
  const [messages, setMessages] = React.useState<OptimisticMessage[]>([]);
  const [participants, setParticipants] = React.useState<ConversationParticipantView[]>(
    initialParticipants ?? [],
  );
  const [typingUsers, setTypingUsers] = React.useState<TypingParticipant[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [sending, setSending] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Re-seed participants when navigating between conversations.
  React.useEffect(() => {
    setParticipants(initialParticipants ?? []);
  }, [initialParticipants]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchMessages(conversationId, { limit: 100 });
      setMessages(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  // markRead wrapper that fires the same-tab `messaging:read` event so
  // peer components (inbox sidebar, inbox icon, bell) can refresh
  // instantly without waiting for a realtime round-trip.
  const markReadAndAnnounce = React.useCallback(async () => {
    try {
      await markConversationReadApi(conversationId);
      dispatchMessagingRead(conversationId);
    } catch {
      // Best-effort; the inbox refresh will eventually correct it.
    }
  }, [conversationId]);

  // Refresh the participants snapshot from the server — used when an
  // admin / org-staff member is auto-joined as a participant via the
  // BEFORE-INSERT messages trigger or the mark-read upsert. We hold it
  // in a ref so the realtime channel callback (which closes over the
  // *initial* render's bindings) can always reach the latest version.
  const refreshParticipants = React.useCallback(async () => {
    try {
      const next = await fetchConversationParticipants(conversationId);
      setParticipants(next);
    } catch {
      // Non-fatal: the next page navigation will re-load via SSR.
    }
  }, [conversationId]);
  const refreshParticipantsRef = React.useRef(refreshParticipants);
  React.useEffect(() => {
    refreshParticipantsRef.current = refreshParticipants;
  }, [refreshParticipants]);

  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });
    void markReadAndAnnounce();
    return () => {
      cancelled = true;
    };
  }, [refresh, markReadAndAnnounce]);

  // Re-mark on tab focus — covers the case where new messages arrived
  // while the tab was backgrounded. Idempotent (RPC clamps with
  // greatest()).
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onFocus = () => {
      if (document.visibilityState === 'visible') void markReadAndAnnounce();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [markReadAndAnnounce]);

  // postgres_changes — messages + conversation_participants.
  React.useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();

    const channel = freshRealtimeChannel(supabase, `conv:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const parsed = Message.safeParse(payload.new);
          if (!parsed.success) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === parsed.data.id)) return prev;
            return [...prev, parsed.data];
          });
          if (parsed.data.sender_id !== selfId) {
            // The notification publisher fan-out runs server-side AFTER
            // the message INSERT, which means our first mark-read can
            // race with the notifications INSERT. We catch the late
            // arrival with a follow-up mark-read shortly after.
            void markReadAndAnnounce();
            window.setTimeout(() => void markReadAndAnnounce(), 800);
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const parsed = Message.safeParse(payload.new);
          if (!parsed.success) return;
          setMessages((prev) => prev.map((m) => (m.id === parsed.data.id ? parsed.data : m)));
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as { user_id?: string; last_read_at?: string } | undefined;
          if (!row?.user_id || !row.last_read_at) return;
          setParticipants((prev) =>
            prev.map((p) =>
              p.user_id === row.user_id ? { ...p, last_read_at: row.last_read_at as string } : p,
            ),
          );
        },
      )
      // INSERT fires when an admin / org-staff is auto-joined as a
      // participant via the BEFORE-INSERT messages trigger or via
      // mark_conversation_fully_read upsert. Refreshing the local
      // participant cache (with the freshly-fetched server snapshot)
      // means the new sender's display name and ✓✓ tracking start
      // working without a page reload.
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_participants',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void refreshParticipantsRef.current?.();
        },
      )
      // Bell-suppression: the message_received fan-out inserts a
      // notification AFTER the message INSERT, so our mark-read on
      // receiving a message can race with the notification row landing.
      // If a notification scoped to *this* conversation arrives while
      // we're looking at it, mark-read again so the bell never holds
      // a count for a message the user is actively reading.
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${selfId}`,
        },
        (payload) => {
          const row = payload.new as { entity_type?: string; entity_id?: string } | undefined;
          if (row?.entity_type === 'conversation' && row.entity_id === conversationId) {
            void markReadAndAnnounce();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, selfId, markReadAndAnnounce]);

  // Typing indicator — uses Supabase Realtime `broadcast`, completely
  // separate from postgres_changes. Channel name is unique per
  // conversation; only people who already know the conversation id (i.e.
  // its participants per RLS) can join.
  const typingChannelRef = React.useRef<ReturnType<
    ReturnType<typeof createClient>['channel']
  > | null>(null);
  const lastTypingBroadcastRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();
    const channel = supabase.channel(`typing:${conversationId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const data = payload as { user_id?: string; full_name?: string } | undefined;
        if (!data?.user_id || data.user_id === selfId) return;
        const expiresAt = Date.now() + TYPING_EXPIRY_MS;
        setTypingUsers((prev) => {
          const without = prev.filter((u) => u.userId !== data.user_id);
          return [
            ...without,
            {
              userId: data.user_id as string,
              fullName: data.full_name ?? '',
              expiresAt,
            },
          ];
        });
      })
      .subscribe();

    typingChannelRef.current = channel;
    return () => {
      typingChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [conversationId, selfId]);

  // Sweep expired typers every second so the strip disappears even if
  // the typer just stops broadcasting (e.g. closed the tab).
  React.useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const live = prev.filter((u) => u.expiresAt > now);
        return live.length === prev.length ? prev : live;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const notifyTyping = React.useCallback(() => {
    const channel = typingChannelRef.current;
    if (!channel) return;
    const now = Date.now();
    if (now - lastTypingBroadcastRef.current < TYPING_BROADCAST_THROTTLE_MS) return;
    lastTypingBroadcastRef.current = now;
    void channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: selfId, full_name: selfName ?? '' },
    });
  }, [selfId, selfName]);

  const send = React.useCallback(
    async (body: string): Promise<void> => {
      const trimmed = body.trim();
      if (!trimmed) return;

      const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: OptimisticMessage = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: selfId,
        body: trimmed,
        created_at: new Date().toISOString(),
        deleted_at: null,
        edited_at: null,
        __pending: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      setSending(true);
      try {
        const real = await sendMessageApi({
          conversation_id: conversationId,
          body: trimmed,
        });
        setMessages((prev) =>
          prev
            .map((m) => (m.id === tempId ? { ...real } : m))
            .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i),
        );
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, __pending: false, __failed: true } : m)),
        );
        setError(err instanceof Error ? err.message : 'Failed to send');
      } finally {
        setSending(false);
      }
    },
    [conversationId, selfId],
  );

  return {
    messages,
    participants,
    typingUsers,
    loading,
    sending,
    error,
    send,
    refresh,
    markRead: markReadAndAnnounce,
    notifyTyping,
  };
}
