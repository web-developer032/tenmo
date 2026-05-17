import { markConversationRead } from '@/features/messaging/server';
import { handler } from '@/lib/handler';

type RouteParams = { id: string };

/**
 * PATCH /api/conversations/[id]/read — advance the caller's `last_read_at`
 * cursor to now. Idempotent.
 */
export const PATCH = handler<RouteParams>(
  async (ctx, { id }) => {
    const last_read_at = await markConversationRead(ctx, id);
    return Response.json({ data: { last_read_at } });
  },
  { requireAuth: true },
);
