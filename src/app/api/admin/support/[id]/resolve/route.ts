import { z } from 'zod';
import { assertAdmin, getAdminSelf } from '@/features/admin/server';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Mark a platform support ticket as resolved.
 *
 * Allowed roles: super, support.
 *
 * Optional resolution note is stored on the ticket description for
 * MVP — a richer comment thread is out of scope this phase.
 */

const Body = z
  .object({
    resolution: z.string().min(2).max(1000).optional(),
  })
  .partial()
  .optional();

export const POST = handler<{ id: string }>(
  async (ctx, params) => {
    await assertAdmin(ctx);
    const { req, supabase, user } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    if (!['super', 'support'].includes(self.role)) {
      throw new BusinessRuleError('Insufficient role to resolve tickets');
    }

    const json = await req.json().catch(() => undefined);
    const parsed = Body ? Body.parse(json ?? {}) : undefined;

    const { data: ticket, error: lookupErr } = await supabase
      .from('platform_support_tickets')
      .select('id, status, ref_number, description')
      .eq('id', params.id)
      .maybeSingle();
    if (lookupErr) throw new DbError(lookupErr);
    if (!ticket) throw new NotFoundError();
    if (ticket.status === 'resolved') {
      throw new BusinessRuleError('Ticket is already resolved');
    }

    const nextDescription = parsed?.resolution
      ? `${ticket.description ?? ''}\n\n— Resolved: ${parsed.resolution}`.trim()
      : ticket.description;

    const { error: updErr } = await supabase
      .from('platform_support_tickets')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        description: nextDescription,
      })
      .eq('id', params.id);
    if (updErr) throw new DbError(updErr);

    await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'support_ticket_resolved',
      payload: { ticket_id: params.id, ref_number: ticket.ref_number },
    });

    return Response.json({ data: { id: params.id, status: 'resolved' } });
  },
  { requireAuth: true },
);
