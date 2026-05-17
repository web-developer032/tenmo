'use client';

import * as React from 'react';
import { Notification, type NotificationListFilter } from '@/core/schemas/notification';
import { subscribeMessagingRead } from '@/features/messaging/events';
import { createClient } from '@/lib/supabase/client';
import { fetchNotifications, type NotificationListResponse } from '../api/client';

/**
 * Live notification feed for the bell + full feed page.
 *
 * Responsibilities:
 *  - Initial fetch via `/api/notifications` (respects RLS, unifies envelope).
 *  - Realtime subscription on `public.notifications` filtered by user_id —
 *    INSERT prepends, UPDATE patches in place (e.g. read_at), DELETE removes.
 *  - Exposes `refresh()` for explicit re-pulls (after marking read, etc.).
 *  - Falls back to a 60s polling interval if the realtime channel can't be
 *    established (e.g. self-hosted Supabase without realtime). Most users
 *    will see push updates instantly via the channel.
 */
export type UseNotificationFeedOptions = {
  userId: string;
  initial?: NotificationListResponse;
  filter?: Partial<NotificationListFilter>;
  /** Polling fallback in ms when the realtime channel never opens. */
  pollIntervalMs?: number;
};

export type UseNotificationFeed = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Optimistic local-only update — server side is source of truth. */
  applyLocalRead: (ids: string[]) => void;
  applyLocalReadAll: () => void;
};

const POLL_FALLBACK_MS = 60_000;

export function useNotificationFeed(options: UseNotificationFeedOptions): UseNotificationFeed {
  const { userId, initial, filter, pollIntervalMs = POLL_FALLBACK_MS } = options;
  const filterRef = React.useRef(filter);

  // Keep `filterRef` in sync with the latest filter without writing to it
  // during render (React 19 / React Compiler flags ref writes in render).
  React.useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  const [notifications, setNotifications] = React.useState<Notification[]>(
    initial?.notifications ?? [],
  );
  const [unreadCount, setUnreadCount] = React.useState<number>(initial?.unread.total ?? 0);
  const [loading, setLoading] = React.useState<boolean>(!initial);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotifications(filterRef.current);
      setNotifications(data.notifications);
      setUnreadCount(data.unread.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  // Kick off the initial fetch in a microtask so we never call setState
  // synchronously inside the effect (avoids cascading-render warnings in
  // React 19's Compiler).
  React.useEffect(() => {
    if (initial) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [initial, refresh]);

  React.useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    let realtimeOpen = false;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const parsed = Notification.safeParse(payload.new);
          if (!parsed.success) return;
          setNotifications((prev) => {
            if (prev.some((n) => n.id === parsed.data.id)) return prev;
            return [parsed.data, ...prev];
          });
          if (!parsed.data.read_at) setUnreadCount((c) => c + 1);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const parsed = Notification.safeParse(payload.new);
          if (!parsed.success) return;
          setNotifications((prev) => prev.map((n) => (n.id === parsed.data.id ? parsed.data : n)));
          // Recompute unread count from the new state to keep the badge consistent.
          setUnreadCount((c) => {
            const prevWasUnread = !(payload.old as { read_at?: string | null })?.read_at;
            const nowUnread = !parsed.data.read_at;
            if (prevWasUnread && !nowUnread) return Math.max(0, c - 1);
            if (!prevWasUnread && nowUnread) return c + 1;
            return c;
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const oldRow = payload.old as { id?: string; read_at?: string | null };
          if (!oldRow.id) return;
          setNotifications((prev) => prev.filter((n) => n.id !== oldRow.id));
          if (!oldRow.read_at) setUnreadCount((c) => Math.max(0, c - 1));
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') realtimeOpen = true;
      });

    const fallbackTimer = setInterval(() => {
      if (!realtimeOpen) void refresh();
    }, pollIntervalMs);

    return () => {
      clearInterval(fallbackTimer);
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh, pollIntervalMs]);

  // When the active thread marks itself read, the server-side RPC also
  // clears related `message_received` notifications. Refresh in the same
  // tab immediately so the bell badge clears without a realtime delay.
  React.useEffect(() => subscribeMessagingRead(() => void refresh()), [refresh]);

  const applyLocalRead = React.useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    const idSet = new Set(ids);
    setNotifications((prev) =>
      prev.map((n) => (idSet.has(n.id) && !n.read_at ? { ...n, read_at: now } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - ids.length));
  }, []);

  const applyLocalReadAll = React.useCallback(() => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    applyLocalRead,
    applyLocalReadAll,
  };
}
