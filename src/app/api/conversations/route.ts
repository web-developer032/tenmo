import { FindOrCreateDirectInput } from '@/core/schemas/messaging';
import {
  findOrCreateDirectConversation,
  listConversationsForUser,
  unreadMessagesCount,
} from '@/features/messaging/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/conversations — inbox payload for the caller.
 *
 * Returns `{ conversations, unread_total }` so the inbox + app-shell
 * badge can render from a single round-trip.
 */
export const GET = handler(
  async (ctx) => {
    const [conversations, unread_total] = await Promise.all([
      listConversationsForUser(ctx),
      unreadMessagesCount(ctx),
    ]);
    return Response.json({ data: { conversations, unread_total } });
  },
  { requireAuth: true },
);

/**
 * POST /api/conversations — find-or-create a 1-1 direct conversation
 * with another user inside an org both parties belong to.
 *
 * Returns `{ conversation_id }`. Idempotent.
 */
export const POST = handler(
  async (ctx) => {
    const body = FindOrCreateDirectInput.parse(await ctx.req.json());
    const conversationId = await findOrCreateDirectConversation(ctx, body);
    return Response.json({ data: { conversation_id: conversationId } });
  },
  { requireAuth: true },
);
