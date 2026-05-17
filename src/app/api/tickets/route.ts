import { CreateTicketInput } from '@/core/schemas/ticket';
import { createTicket } from '@/features/tickets/server';
import { handler, requireUser } from '@/lib/handler';

/**
 * POST /api/tickets — create a new maintenance ticket.
 *
 * Both tenants and landlords use the same endpoint; RLS gates which
 * tenancy/property they may target. The `create_ticket` RPC inserts the
 * ticket and its first message atomically and writes the audit row.
 */
export const POST = handler(
  async (ctx) => {
    const user = requireUser(ctx);
    const json = await ctx.req.json().catch(() => ({}));
    const input = CreateTicketInput.parse(json);

    const result = await createTicket(ctx, input, user);
    return Response.json({ data: result }, { status: 201 });
  },
  { requireAuth: true },
);
