import 'server-only';
import {
  Notification,
  type NotificationListFilter,
  type NotificationPreferences,
} from '@/core/schemas/notification';
import { parseNotificationPreferences } from '@/core/utils/notification-rules';
import { createClient } from '@/lib/supabase/server';

export type NotificationFeed = {
  notifications: Notification[];
  unreadCount: number;
};

/**
 * Initial feed data for the bell component or full feed page.
 *
 * Server-only loader (cookies-aware Supabase client → respects RLS for
 * the current user). Use directly in Server Components without going
 * through a Route Handler.
 */
export async function loadNotificationFeed(
  limit = 10,
  filter?: Partial<NotificationListFilter>,
): Promise<NotificationFeed> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { notifications: [], unreadCount: 0 };
  }

  let listQuery = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filter?.unread_only) listQuery = listQuery.is('read_at', null);
  if (filter?.kinds && filter.kinds.length > 0) listQuery = listQuery.in('kind', filter.kinds);
  if (filter?.before) listQuery = listQuery.lt('created_at', filter.before);

  const [{ data: rows, error: listErr }, { data: count, error: countErr }] = await Promise.all([
    listQuery,
    supabase.rpc('unread_notifications_count'),
  ]);

  if (listErr || countErr) {
    return { notifications: [], unreadCount: 0 };
  }

  const notifications = (rows ?? []).map((row) => Notification.parse(row));
  return {
    notifications,
    unreadCount: typeof count === 'number' ? count : 0,
  };
}

/**
 * Load the caller's resolved preferences for the settings page. Always
 * returns a fully-populated object with defaults applied so the UI can
 * reflect "what would happen right now" without resolving them itself.
 */
export async function loadNotificationPreferences(): Promise<NotificationPreferences | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('notification_prefs')
    .eq('id', user.id)
    .maybeSingle();
  if (error) return parseNotificationPreferences(null);
  return parseNotificationPreferences(data?.notification_prefs ?? null);
}
