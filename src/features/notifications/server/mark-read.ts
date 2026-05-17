import 'server-only';
import type { HandlerContext } from '@/lib/handler';
import { requireUser } from '@/lib/handler';

/** Mark a list of notification ids as read. Returns the number of rows changed. */
export async function markNotificationsRead(
  ctx: HandlerContext,
  notificationIds: string[],
): Promise<number> {
  requireUser(ctx);
  if (notificationIds.length === 0) return 0;
  const { data, error } = await ctx.supabase.rpc('mark_notifications_read', {
    notification_ids: notificationIds,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

/** Mark every unread notification for the caller as read. */
export async function markAllNotificationsRead(ctx: HandlerContext): Promise<number> {
  requireUser(ctx);
  const { data, error } = await ctx.supabase.rpc('mark_all_notifications_read');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}
