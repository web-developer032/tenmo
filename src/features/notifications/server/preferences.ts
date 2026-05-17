import 'server-only';
import type {
  NotificationPreferences,
  NotificationPreferencesPatch,
} from '@/core/schemas/notification';
import { mergePreferences, parseNotificationPreferences } from '@/core/utils/notification-rules';
import type { HandlerContext } from '@/lib/handler';
import { requireUser } from '@/lib/handler';

/**
 * Read the caller's notification preferences. Always returns a fully
 * populated object — missing keys are filled with defaults so the UI can
 * reflect "what would happen right now" without resolving them itself.
 */
export async function getNotificationPreferences(
  ctx: HandlerContext,
): Promise<NotificationPreferences> {
  const user = requireUser(ctx);
  const { data, error } = await ctx.supabase
    .from('profiles')
    .select('notification_prefs')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return parseNotificationPreferences(data?.notification_prefs ?? null);
}

/**
 * Apply a patch on top of the caller's existing preferences. The patch
 * may omit either side (channels or per-kind toggles) and we'll keep the
 * rest as-is. Returns the resulting full preferences object.
 */
export async function updateNotificationPreferences(
  ctx: HandlerContext,
  patch: NotificationPreferencesPatch,
): Promise<NotificationPreferences> {
  const user = requireUser(ctx);
  const current = await getNotificationPreferences(ctx);
  const next = mergePreferences(current, patch);

  const { error } = await ctx.supabase
    .from('profiles')
    .update({ notification_prefs: next as unknown as Record<string, unknown> })
    .eq('id', user.id);
  if (error) throw error;
  return next;
}
