import { AssignTicketInput } from '@/core/schemas/ticket';
import { assignTicket } from '@/features/tickets/server';
import { ErrorCode, ForbiddenError } from '@/lib/errors';
import { handler, requireUser } from '@/lib/handler';

/**
 * PATCH /api/tickets/[ticketId]/assign — landlord-side assignment.
 *
 * Sets `assigned_to_user_id` (an org member) and/or `assigned_contractor`
 * (free-text, until we have a contractors table). RLS already restricts
 * updates to landlord roles; this endpoint additionally bails out for
 * tenants with a clear 403 instead of a Postgres-shaped row-not-found.
 */
export const PATCH = handler<{ ticketId: string }>(
  async (ctx, params) => {
    const user = requireUser(ctx);
    const json = await ctx.req.json().catch(() => ({}));
    const input = AssignTicketInput.parse(json);

    // Soft pre-check so tenants get an honest error. RLS still has the
    // final say — a stale membership won't slip past it.
    const { data: ticket } = await ctx.supabase
      .from('tickets')
      .select('org_id')
      .eq('id', params.ticketId)
      .maybeSingle();
    if (ticket) {
      const { data: membership } = await ctx.supabase
        .from('org_memberships')
        .select('role')
        .eq('org_id', ticket.org_id)
        .eq('user_id', user.id)
        .is('revoked_at', null)
        .maybeSingle();
      if (!membership || !['owner', 'agent', 'staff'].includes(membership.role)) {
        throw new ForbiddenError(ErrorCode.forbidden, 'Only landlord roles can assign tickets');
      }
    }

    const updated = await assignTicket(ctx, params.ticketId, input);
    return Response.json({ data: updated });
  },
  { requireAuth: true },
);
