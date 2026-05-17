'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchInbox, type InboxResponse } from '../api/client';
import { subscribeMessagingRead } from '../events';

/**
 * Live inbox feed for the /messages page + the app-shell badge.
 *
 * Mirrors `useNotificationFeed`:
 *   * Initial fetch via `/api/conversations`
 *   * Realtime subscription on `public.messages` (no user_id filter — we
 *     can't filter by participant on the wire, so we re-fetch the inbox
 *     when *any* message lands and let RLS trim the result on the server)
 *   * Polling fallback every 60s if the channel never opens
 *
 * The "refetch on any message" approach is deliberately coarse: the
 * inbox payload is small (<= 100 conversations) and changes are rare
 * enough that an extra round-trip per delivered message is fine. It
 * also keeps unread counts + previews accurate without re-deriving
 * them on the client.
 */
export type UseInboxOptions = {
  userId: string;
  initial?: InboxResponse;
  pollIntervalMs?: number;
};

const POLL_FALLBACK_MS = 60_000;

export function useInbox(options: UseInboxOptions) {
  const { userId, initial, pollIntervalMs = POLL_FALLBACK_MS } = options;

  const [data, setData] = React.useState<InboxResponse>(
    initial ?? { conversations: [], unread_total: 0 },
  );
  const [loading, setLoading] = React.useState<boolean>(!initial);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchInbox();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, []);

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
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const debouncedRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = null;
        void refresh();
      }, 300);
    };

    const channel = supabase
      .channel(`inbox:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        debouncedRefresh();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
        debouncedRefresh();
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          debouncedRefresh();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') realtimeOpen = true;
      });

    const fallbackTimer = setInterval(() => {
      if (!realtimeOpen) void refresh();
    }, pollIntervalMs);

    return () => {
      if (debounce) clearTimeout(debounce);
      clearInterval(fallbackTimer);
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh, pollIntervalMs]);

  // Same-tab fast path: when the active thread marks itself read, refresh
  // immediately rather than waiting for the realtime UPDATE round-trip.
  React.useEffect(() => subscribeMessagingRead(() => void refresh()), [refresh]);

  return { data, loading, error, refresh };
}
