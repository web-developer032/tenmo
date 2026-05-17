import { MarkNotificationsReadInput } from '@/core/schemas/notification';
import { markNotificationsRead } from '@/features/notifications/server';
import { handler } from '@/lib/handler';

/**
 * PATCH /api/notifications/mark-read — mark a specific list of
 * notification ids as read. Used by the bell dropdown when a user
 * clicks one row, and by the full feed bulk action.
 */
export const PATCH = handler(
  async (ctx) => {
    const json = await ctx.req.json().catch(() => ({}));
    const { ids } = MarkNotificationsReadInput.parse(json);
    const updated = await markNotificationsRead(ctx, ids);
    return Response.json({ data: { updated } });
  },
  { requireAuth: true },
);
