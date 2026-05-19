import { z } from 'zod';
import { assertAdmin, getAdminSelf } from '@/features/admin/server';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Update / revoke an admin team member.
 *
 * Allowed roles: super only.
 *
 * Self-mutation guard: a super admin can't demote or revoke
 * themselves — we always need at least one super in the system, and
 * preventing self-revocation handles the obvious lockout footgun.
 */

const PatchBody = z
  .object({
    role: z.enum(['super', 'support', 'finance', 'readonly']).optional(),
    status: z.enum(['active', 'disabled']).optional(),
  })
  .strict()
  .refine((v) => v.role !== undefined || v.status !== undefined, {
    message: 'Provide role and/or status',
  });

export const PATCH = handler<{ userId: string }>(
  async (ctx, params) => {
    await assertAdmin(ctx);
    const { req, supabase, user } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    if (self.role !== 'super') {
      throw new BusinessRuleError('Only super admins can edit the team');
    }

    if (params.userId === user.id) {
      throw new BusinessRuleError('You cannot edit your own admin row from this page');
    }

    const json = await req.json().catch(() => ({}));
    const input = PatchBody.parse(json);

    const { data: target, error: lookupErr } = await supabase
      .from('admin_users')
      .select('user_id, role, status')
      .eq('user_id', params.userId)
      .maybeSingle();
    if (lookupErr) throw new DbError(lookupErr);
    if (!target) throw new NotFoundError();

    const { error: updErr } = await supabase
      .from('admin_users')
      .update({
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      })
      .eq('user_id', params.userId);
    if (updErr) throw new DbError(updErr);

    await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'admin_role_changed',
      target_user_id: params.userId,
      payload: {
        previous_role: target.role,
        previous_status: target.status,
        new_role: input.role ?? target.role,
        new_status: input.status ?? target.status,
      },
    });

    return Response.json({ data: { user_id: params.userId } });
  },
  { requireAuth: true },
);

export const DELETE = handler<{ userId: string }>(
  async (ctx, params) => {
    await assertAdmin(ctx);
    const { supabase, user } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    if (self.role !== 'super') {
      throw new BusinessRuleError('Only super admins can revoke the team');
    }
    if (params.userId === user.id) {
      throw new BusinessRuleError('You cannot revoke yourself');
    }

    const { error: delErr } = await supabase
      .from('admin_users')
      .delete()
      .eq('user_id', params.userId);
    if (delErr) throw new DbError(delErr);

    await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'admin_revoked',
      target_user_id: params.userId,
      payload: null,
    });

    return Response.json({ data: { user_id: params.userId } });
  },
  { requireAuth: true },
);
