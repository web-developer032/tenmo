import { ChangeTicketStatusInput } from '@/core/schemas/ticket';
import { changeTicketStatus, resolveActorRole } from '@/features/tickets/server';
import { handler } from '@/lib/handler';

/**
 * PATCH /api/tickets/[ticketId]/status — move a ticket between states.
 *
 * Allowed transitions are governed by `core/utils/ticket-rules.ts` and
 * scoped by the caller's role for this ticket. The DB layer also writes
 * a system_status audit message via the `change_ticket_status` RPC.
 */
export const PATCH = handler<{ ticketId: string }>(
  async (ctx, params) => {
    const json = await ctx.req.json().catch(() => ({}));
    const input = ChangeTicketStatusInput.parse(json);

    const role = await resolveActorRole(ctx, params.ticketId);
    const ticket = await changeTicketStatus(ctx, params.ticketId, role, input);
    return Response.json({ data: ticket });
  },
  { requireAuth: true },
);
