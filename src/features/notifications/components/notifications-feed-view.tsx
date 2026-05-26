'use client';

import { Bell, CheckCheck, Filter, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader, SectionCard } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  NOTIFICATION_GROUP_LABEL,
  NOTIFICATION_KIND_RULES,
  NOTIFICATION_PAGE_SIZE,
  type NotificationGroup,
  type NotificationKind,
} from '@/core/constants/notifications';
import type { Notification } from '@/core/schemas/notification';
import { cn } from '@/lib/cn';
import {
  fetchNotifications,
  markAllNotificationsReadApi,
  markNotificationsReadApi,
  type NotificationListResponse,
} from '../api/client';
import { useNotificationFeed } from '../hooks/use-notification-feed';
import { NotificationRow } from './notification-row';

/**
 * Full feed page (`/notifications`).
 *
 * Behaviour:
 *  - Mirrors the bell component (same data hook, realtime, mark-read).
 *  - Adds group filter chips (All / Compliance / Rent / Maintenance / …)
 *    and an Unread-only toggle.
 *  - Paginated via "Load older" button (keyset on `created_at`).
 *  - Click a row → mark read + navigate to its `link_url`.
 */

type FilterGroup = 'all' | 'unread' | NotificationGroup;

const GROUPS: NotificationGroup[] = [
  'compliance',
  'rent',
  'tickets',
  'tenancies',
  'messages',
  'billing',
  'documents',
  'listings',
  'system',
];

const KINDS_BY_GROUP: Record<NotificationGroup, NotificationKind[]> = (() => {
  const acc: Record<NotificationGroup, NotificationKind[]> = {
    compliance: [],
    rent: [],
    tickets: [],
    tenancies: [],
    messages: [],
    billing: [],
    documents: [],
    listings: [],
    system: [],
  };
  for (const rule of Object.values(NOTIFICATION_KIND_RULES)) {
    acc[rule.group].push(rule.kind);
  }
  return acc;
})();

export type NotificationsFeedViewProps = {
  userId: string;
  initial: NotificationListResponse;
};

export function NotificationsFeedView({ userId, initial }: NotificationsFeedViewProps) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<FilterGroup>('all');
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(
    initial.notifications.length >= NOTIFICATION_PAGE_SIZE,
  );
  const [olderRows, setOlderRows] = React.useState<Notification[]>([]);
  const [markingAll, setMarkingAll] = React.useState(false);

  const { kinds, unreadOnly } = React.useMemo(() => {
    if (filter === 'all') return { kinds: undefined, unreadOnly: false };
    if (filter === 'unread') return { kinds: undefined, unreadOnly: true };
    return { kinds: KINDS_BY_GROUP[filter], unreadOnly: false };
  }, [filter]);

  const {
    notifications: liveRows,
    unreadCount,
    error,
    refresh,
    applyLocalRead,
    applyLocalReadAll,
  } = useNotificationFeed({
    userId,
    initial: filter === 'all' ? initial : undefined,
    filter: { limit: NOTIFICATION_PAGE_SIZE, kinds, unread_only: unreadOnly },
  });

  // Reset the "older" pagination tail whenever the active filter changes.
  // Render-phase reset (React's recommended pattern for resetting state
  // when a prop changes) — avoids the cascading-render warning emitted by
  // React 19's Compiler when this lives in a useEffect.
  const [prevFilter, setPrevFilter] = React.useState(filter);
  if (prevFilter !== filter) {
    setPrevFilter(filter);
    setOlderRows([]);
    setHasMore(true);
  }

  const allRows = React.useMemo(() => {
    const seen = new Set<string>();
    const merged: Notification[] = [];
    for (const row of [...liveRows, ...olderRows]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
    }
    return merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [liveRows, olderRows]);

  const onLoadMore = React.useCallback(async () => {
    const oldest = allRows[allRows.length - 1];
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchNotifications({
        limit: NOTIFICATION_PAGE_SIZE,
        before: oldest.created_at,
        kinds,
        unread_only: unreadOnly,
      });
      setOlderRows((prev) => [...prev, ...data.notifications]);
      if (data.notifications.length < NOTIFICATION_PAGE_SIZE) setHasMore(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load more');
    } finally {
      setLoadingMore(false);
    }
  }, [allRows, kinds, loadingMore, unreadOnly]);

  const onSelect = React.useCallback(
    (n: Notification) => {
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

  const subDescription =
    unreadCount > 0
      ? `${unreadCount} unread · sorted by most recent`
      : 'All caught up · sorted by most recent';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description={subDescription}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onMarkAll}
            disabled={unreadCount === 0 || markingAll}
          >
            {markingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            Mark all read
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-ink-light" aria-hidden="true" />
        <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterChip
          label={`Unread${unreadCount > 0 ? ` · ${unreadCount}` : ''}`}
          active={filter === 'unread'}
          onClick={() => setFilter('unread')}
        />
        {GROUPS.map((g) => (
          <FilterChip
            key={g}
            label={NOTIFICATION_GROUP_LABEL[g]}
            active={filter === g}
            onClick={() => setFilter(g)}
          />
        ))}
      </div>

      {error ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : allRows.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="You're all caught up"
          description={
            filter === 'unread'
              ? "You have no unread notifications. We'll let you know when something needs you."
              : "Nothing here yet. We'll notify you about compliance, rent, tickets and more."
          }
        />
      ) : (
        <SectionCard padded={false} className="max-w-3xl">
          <ul className="divide-y divide-border-soft">
            {allRows.map((n) => (
              <li key={n.id}>
                <NotificationRow notification={n} onClick={onSelect} />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {allRows.length > 0 && hasMore ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Load older
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-[12px] font-medium transition-colors',
        active
          ? 'border-forest-600 bg-forest-600 text-white'
          : 'border-border-soft bg-white text-ink-light hover:border-ink/30 hover:text-ink',
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
