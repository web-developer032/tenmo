import { ListMessagesQuery, SendMessageInput } from '@/core/schemas/messaging';
import { listMessages, sendMessage } from '@/features/messaging/server';
import { handler } from '@/lib/handler';

type RouteParams = { id: string };

/**
 * GET /api/conversations/[id]/messages — keyset-paginated message page.
 *
 * Query params:
 *   - limit=50
 *   - before=<iso datetime>  (older-than cursor)
 */
export const GET = handler<RouteParams>(
  async (ctx, { id }) => {
    const url = ctx.req.nextUrl;
    const limitRaw = url.searchParams.get('limit');
    const before = url.searchParams.get('before') ?? undefined;

    const query = ListMessagesQuery.parse({
      conversation_id: id,
      limit: limitRaw ? Number(limitRaw) : 50,
      before,
    });
    const messages = await listMessages(ctx, query);
    return Response.json({ data: { messages } });
  },
  { requireAuth: true },
);

/**
 * POST /api/conversations/[id]/messages — append a new message and
 * notify the other participants.
 */
export const POST = handler<RouteParams>(
  async (ctx, { id }) => {
    const json = (await ctx.req.json()) as Record<string, unknown>;
    const input = SendMessageInput.parse({ ...json, conversation_id: id });
    const message = await sendMessage(ctx, input);
    return Response.json({ data: { message } }, { status: 201 });
  },
  { requireAuth: true },
);
