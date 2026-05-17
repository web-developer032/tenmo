import { AddTicketMessageInput } from '@/core/schemas/ticket';
import { addTicketMessage } from '@/features/tickets/server';
import { handler } from '@/lib/handler';

/**
 * POST /api/tickets/[ticketId]/messages — append a comment to a ticket.
 *
 * Attachment paths are expected to point into the `ticket-attachments`
 * bucket and to have been uploaded directly by the client using a signed
 * URL minted by `/api/tickets/[ticketId]/attachments/upload-url`.
 *
 * RLS rejects messages on tickets the caller can't see, returning the
 * canonical not_found shape.
 */
export const POST = handler<{ ticketId: string }>(
  async (ctx, params) => {
    const json = await ctx.req.json().catch(() => ({}));
    const input = AddTicketMessageInput.parse(json);

    const message = await addTicketMessage(ctx, params.ticketId, input);
    return Response.json({ data: message }, { status: 201 });
  },
  { requireAuth: true },
);
