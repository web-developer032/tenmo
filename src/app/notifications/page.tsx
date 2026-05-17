import { redirect } from 'next/navigation';
import { NOTIFICATION_PAGE_SIZE } from '@/core/constants/notifications';
import { NotificationsFeedView } from '@/features/notifications/components/notifications-feed-view';
import { loadNotificationFeed } from '@/features/notifications/loaders';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * `/notifications` — the user's full feed. Server-renders the first page
 * (RLS-scoped) so the list is visible on the first paint, then the
 * client view takes over for filtering, pagination and realtime updates.
 */
export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/notifications');

  const feed = await loadNotificationFeed(NOTIFICATION_PAGE_SIZE);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <NotificationsFeedView
        userId={user.id}
        initial={{
          notifications: feed.notifications,
          unread: { total: feed.unreadCount },
        }}
      />
    </div>
  );
}
