import { loadTicketDetail } from '@/features/tickets/server';
import { NotFoundError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * GET /api/tickets/[ticketId] — fetch a ticket and its message timeline.
 *
 * RLS gates visibility: tenants only see their own tickets, org members
 * see every ticket in their org. Anything else surfaces as 404.
 */
export const GET = handler<{ ticketId: string }>(
  async (ctx, params) => {
    const detail = await loadTicketDetail(ctx, params.ticketId);
    if (!detail) throw new NotFoundError('Ticket not found');
    return Response.json({ data: detail });
  },
  { requireAuth: true },
);
