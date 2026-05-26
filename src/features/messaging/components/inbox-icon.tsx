'use client';

import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';
import { freshRealtimeChannel } from '@/lib/supabase/realtime';
import { fetchInbox } from '../api/client';
import { subscribeMessagingRead } from '../events';

/**
 * App-shell inbox icon — link to `/messages` with an unread badge that
 * stays in sync via Supabase Realtime + a 60s polling fallback.
 *
 * Lighter than the full inbox hook: we only care about the *count* here,
 * not the conversations list, so a single coarse refresh on any
 * `messages` insert is plenty.
 */
export function InboxIcon({
  userId,
  initialUnreadTotal,
}: {
  userId: string;
  initialUnreadTotal: number;
}) {
  const [unread, setUnread] = React.useState(initialUnreadTotal);

  const refresh = React.useCallback(async () => {
    try {
      const data = await fetchInbox();
      setUnread(data.unread_total);
    } catch {
      // Best-effort.
    }
  }, []);

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
      }, 400);
    };

    const channel = freshRealtimeChannel(supabase, `inbox-icon:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
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

    const timer = setInterval(() => {
      if (!realtimeOpen) void refresh();
    }, 60_000);

    return () => {
      if (debounce) clearTimeout(debounce);
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  // Same-tab fast path — see use-inbox for rationale.
  React.useEffect(() => subscribeMessagingRead(() => void refresh()), [refresh]);

  const badge = unread > 99 ? '99+' : String(unread);

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={unread > 0 ? `Messages (${unread} unread)` : 'Messages'}
    >
      <Link href="/messages">
        <MessageSquare className="h-5 w-5" />
        {unread > 0 ? (
          <span
            className={cn(
              'absolute -right-0.5 -top-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground',
              'h-[1.1rem]',
            )}
            aria-hidden="true"
          >
            {badge}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
