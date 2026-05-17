import 'server-only';
import { Notification, type NotificationListFilter } from '@/core/schemas/notification';
import type { HandlerContext } from '@/lib/handler';
import { requireUser } from '@/lib/handler';

/**
 * List notifications for the authenticated caller. RLS enforces user_id
 * scoping, but we add an explicit predicate so the partial index is hit.
 *
 * Default ordering: newest first. Pagination is keyset-based on
 * `created_at` to keep the bell-icon snappy as the table grows.
 */
export async function listNotificationsForUser(
  ctx: HandlerContext,
  filter: NotificationListFilter = { limit: 25 },
): Promise<Notification[]> {
  const user = requireUser(ctx);
  const limit = filter.limit ?? 25;

  let query = ctx.supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filter.unread_only) query = query.is('read_at', null);
  if (filter.kinds && filter.kinds.length > 0) query = query.in('kind', filter.kinds);
  if (filter.before) query = query.lt('created_at', filter.before);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => Notification.parse(row));
}

export type UnreadSummary = {
  total: number;
};

export async function getUnreadCount(ctx: HandlerContext): Promise<UnreadSummary> {
  requireUser(ctx);
  const { data, error } = await ctx.supabase.rpc('unread_notifications_count');
  if (error) throw error;
  return { total: typeof data === 'number' ? data : 0 };
}
