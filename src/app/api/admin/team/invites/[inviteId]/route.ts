import { assertAdmin, getAdminSelf, writeAudit } from '@/features/admin/server';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * DELETE /api/admin/team/invites/[inviteId]
 *
 * Revoke a pending admin invite. Super-admin only. The invite row
 * itself is removed (we don't keep history because the email + role
 * never become public until consumed).
 */
export const DELETE = handler<{ inviteId: string }>(
  async (ctx, { inviteId }) => {
    await assertAdmin(ctx);
    const { supabase, user } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    if (self.role !== 'super') {
      throw new BusinessRuleError('Only super admins can revoke invites');
    }

    const { data: invite, error: lookupErr } = await supabase
      .from('admin_invites')
      .select('id, email, role, consumed_at')
      .eq('id', inviteId)
      .maybeSingle();
    if (lookupErr) throw new DbError(lookupErr);
    if (!invite) throw new NotFoundError();
    if (invite.consumed_at) {
      throw new BusinessRuleError('Invite has already been accepted');
    }

    const { error: delErr } = await supabase.from('admin_invites').delete().eq('id', inviteId);
    if (delErr) throw new DbError(delErr);

    await writeAudit(ctx, {
      event: 'admin_invite_revoked',
      payload: { invite_id: inviteId, email: invite.email, role: invite.role },
    });

    return Response.json({ data: { invite_id: inviteId, revoked: true } });
  },
  { requireAuth: true },
);
