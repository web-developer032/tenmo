'use client';

import { Bell, CheckCheck, Loader2, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NOTIFICATION_BELL_LIMIT } from '@/core/constants/notifications';
import type { Notification } from '@/core/schemas/notification';
import { cn } from '@/lib/cn';
import { markAllNotificationsReadApi, markNotificationsReadApi } from '../api/client';
import {
  type UseNotificationFeedOptions,
  useNotificationFeed,
} from '../hooks/use-notification-feed';
import { NotificationRow } from './notification-row';

/**
 * Bell icon for the app shell header.
 *
 * Composition:
 *  - Trigger: bell button + unread badge (capped at 99+).
 *  - Panel: latest N notifications (newest first), realtime updates, and
 *    a "Mark all read" action. Clicking a row marks it read, closes the
 *    panel, and routes to `link_url` if present.
 *  - Footer: "Open all notifications" → `/notifications`.
 *
 * Designed to be a drop-in widget — parents only pass the current user id
 * and (optionally) a server-rendered initial feed to avoid a fetch flash.
 */

export type NotificationBellProps = Pick<UseNotificationFeedOptions, 'userId' | 'initial'>;

export function NotificationBell({ userId, initial }: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [markingAll, setMarkingAll] = React.useState(false);

  const { notifications, unreadCount, loading, error, refresh, applyLocalRead, applyLocalReadAll } =
    useNotificationFeed({
      userId,
      initial,
      filter: { limit: NOTIFICATION_BELL_LIMIT },
    });

  const onOpenChange = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) void refresh();
    },
    [refresh],
  );

  const onSelectNotification = React.useCallback(
    async (n: Notification) => {
      setOpen(false);
      if (!n.read_at) {
        applyLocalRead([n.id]);
        markNotificationsReadApi([n.id]).catch((err) => {
          toast.error(err instanceof Error ? err.message : 'Could not mark as read');
          void refresh();
        });
      }
      if (n.link_url) router.push(n.link_url);
    },
    [applyLocalRead, refresh, router],
  );

  const onMarkAll = React.useCallback(async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      applyLocalReadAll();
      await markAllNotificationsReadApi();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not mark all as read');
      void refresh();
    } finally {
      setMarkingAll(false);
    }
  }, [unreadCount, markingAll, applyLocalReadAll, refresh]);

  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span
              className={cn(
                'absolute -right-0.5 -top-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground',
                'h-[1.1rem]',
              )}
              aria-hidden="true"
            >
              {badgeText}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-88 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <button
            type="button"
            onClick={onMarkAll}
            disabled={unreadCount === 0 || markingAll}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            {markingAll ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCheck className="h-3 w-3" />
            )}
            Mark all read
          </button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-96 overflow-y-auto">
          {error ? (
            <div className="px-3 py-6 text-center text-sm text-destructive">{error}</div>
          ) : loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center px-3 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-5 w-5 opacity-50" />
              You&apos;re all caught up.
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li key={n.id}>
                  <NotificationRow notification={n} onClick={onSelectNotification} compact />
                </li>
              ))}
            </ul>
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="flex items-center justify-between px-3 py-2">
          <Link
            href="/notifications"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            See all notifications
          </Link>
          <Link
            href="/account/settings/notifications"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(false)}
            aria-label="Notification preferences"
          >
            <Settings className="h-3 w-3" />
            Preferences
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
