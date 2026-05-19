import { assertAdmin, getAdminSelf } from '@/features/admin/server';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Assign a platform support ticket to the calling admin.
 *
 * Allowed roles: super, support.
 *
 * Also flips status `open` → `in_progress` so the SLA timer is honest
 * about who's actively looking at the issue.
 */
export const POST = handler<{ id: string }>(
  async (ctx, params) => {
    await assertAdmin(ctx);
    const { supabase, user } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    if (!['super', 'support'].includes(self.role)) {
      throw new BusinessRuleError('Insufficient role to assign tickets');
    }

    const { data: ticket, error: lookupErr } = await supabase
      .from('platform_support_tickets')
      .select('id, status, assigned_to, ref_number')
      .eq('id', params.id)
      .maybeSingle();
    if (lookupErr) throw new DbError(lookupErr);
    if (!ticket) throw new NotFoundError();

    const newStatus = ticket.status === 'open' ? 'in_progress' : ticket.status;
    const { error: updErr } = await supabase
      .from('platform_support_tickets')
      .update({ assigned_to: user.id, status: newStatus })
      .eq('id', params.id);
    if (updErr) throw new DbError(updErr);

    await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'support_ticket_assigned',
      payload: { ticket_id: params.id, ref_number: ticket.ref_number },
    });

    return Response.json({ data: { id: params.id, assigned_to: user.id, status: newStatus } });
  },
  { requireAuth: true },
);
