import { loadConversationParticipants } from '@/features/messaging/loaders';
import { handler } from '@/lib/handler';

type RouteParams = { id: string };

/**
 * GET /api/conversations/[id]/participants — full participant snapshot
 * (user_id, full_name, contact_email, party_role, last_read_at,
 * is_self).
 *
 * Used by the client to refresh the participant list when realtime
 * fires a `conversation_participants` INSERT (e.g. an admin gets
 * auto-joined via the BEFORE-INSERT trigger or the mark-read upsert).
 *
 * Reuses the same loader the `/messages/[id]` server component uses,
 * so the shape is consistent across SSR + CSR.
 */
export const GET = handler<RouteParams>(
  async (_ctx, { id }) => {
    const participants = await loadConversationParticipants(id);
    return Response.json({ data: { participants } });
  },
  { requireAuth: true },
);
