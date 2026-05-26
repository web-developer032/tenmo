import { z } from 'zod';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import { handler, requireUser } from '@/lib/handler';

/**
 * POST /api/landlord/support/[ticketId]/csat
 *
 * Submit a CSAT rating for a resolved platform support ticket. The
 * reporter (i.e. the landlord who opened the ticket) is the only one
 * allowed to rate it; the policy
 * `platform_support_tickets_csat_by_reporter` enforces this at the
 * row level, but we double-check application-side for friendlier
 * errors.
 *
 * The same endpoint may be used to update an existing rating before
 * the ticket is older than 30 days (we don't enforce a max age here
 * yet but the column is timestamped via `csat_submitted_at` so we
 * can revisit).
 */

const Body = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});

export const POST = handler<{ ticketId: string }>(
  async (ctx, params) => {
    const user = requireUser(ctx);
    const body = Body.parse(await ctx.req.json().catch(() => ({})));

    const { data: ticket, error: lookupErr } = await ctx.supabase
      .from('platform_support_tickets')
      .select('id, ref_number, status, reporter_user_id')
      .eq('id', params.ticketId)
      .maybeSingle();
    if (lookupErr) throw new DbError(lookupErr);
    if (!ticket) throw new NotFoundError();
    if (ticket.reporter_user_id !== user.id) {
      throw new BusinessRuleError('Only the ticket reporter can rate it');
    }
    if (ticket.status !== 'resolved') {
      throw new BusinessRuleError('Tickets can only be rated once resolved');
    }

    const { error: updErr } = await ctx.supabase
      .from('platform_support_tickets')
      .update({
        csat_rating: body.rating,
        csat_comment: body.comment ?? null,
        csat_submitted_at: new Date().toISOString(),
      })
      .eq('id', params.ticketId);
    if (updErr) throw new DbError(updErr);

    await ctx.supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'csat_submitted',
      payload: {
        ticket_id: params.ticketId,
        ref_number: ticket.ref_number,
        rating: body.rating,
      },
    });

    return Response.json({ data: { ticket_id: params.ticketId, rating: body.rating } });
  },
  { requireAuth: true },
);
