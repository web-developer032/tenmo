import { NotificationPreferencesPatch } from '@/core/schemas/notification';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/features/notifications/server';
import { handler } from '@/lib/handler';

/** GET — returns the caller's resolved preferences, defaults applied. */
export const GET = handler(
  async (ctx) => {
    const prefs = await getNotificationPreferences(ctx);
    return Response.json({ data: prefs });
  },
  { requireAuth: true },
);

/**
 * PATCH — accepts a partial preferences update. The server merges the
 * patch on top of the existing prefs so the UI can submit only the
 * keys that changed.
 */
export const PATCH = handler(
  async (ctx) => {
    const json = await ctx.req.json().catch(() => ({}));
    const patch = NotificationPreferencesPatch.parse(json);
    const prefs = await updateNotificationPreferences(ctx, patch);
    return Response.json({ data: prefs });
  },
  { requireAuth: true },
);
