import { NotificationListFilter } from '@/core/schemas/notification';
import {
  getUnreadCount,
  listNotificationsForUser,
  markAllNotificationsRead,
} from '@/features/notifications/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/notifications — paginated list of the caller's notifications.
 *
 * Query params (all optional):
 *   - unread_only=1
 *   - limit=25
 *   - before=<iso datetime>  (keyset pagination on `created_at`)
 *   - kinds=ticket_message,rent_paid  (comma-separated)
 *
 * Response envelope: `{ data: { notifications, unread } }` so the bell can
 * render the badge + dropdown from one round-trip.
 */
export const GET = handler(
  async (ctx) => {
    const url = ctx.req.nextUrl;
    const limitRaw = url.searchParams.get('limit');
    const before = url.searchParams.get('before') ?? undefined;
    const unreadOnly = url.searchParams.get('unread_only');
    const kindsRaw = url.searchParams.get('kinds');

    const filter = NotificationListFilter.parse({
      limit: limitRaw ? Number(limitRaw) : 25,
      before,
      unread_only: unreadOnly === '1' || unreadOnly === 'true',
      kinds: kindsRaw ? kindsRaw.split(',').filter(Boolean) : undefined,
    });

    const [notifications, unread] = await Promise.all([
      listNotificationsForUser(ctx, filter),
      getUnreadCount(ctx),
    ]);

    return Response.json({ data: { notifications, unread } });
  },
  { requireAuth: true },
);

/**
 * PATCH /api/notifications — mark every unread notification for the
 * caller as read. Body is ignored.
 */
export const PATCH = handler(
  async (ctx) => {
    const updated = await markAllNotificationsRead(ctx);
    return Response.json({ data: { updated } });
  },
  { requireAuth: true },
);
