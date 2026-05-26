import { assertAdmin, getAdminSelf, writeAudit } from '@/features/admin/server';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * POST /api/admin/orgs/[orgId]/undelete
 *
 * Restore a soft-deleted landlord by clearing `orgs.deleted_at`.
 * Super-admin only; surfaces from the row affordance on /admin/orgs
 * when `?show_deleted=1` is on. The org's subscription stays in its
 * `canceled` state — the admin will still need to reinstate
 * separately to give the landlord access to paid features.
 */
export const POST = handler<{ orgId: string }>(
  async (ctx, { orgId }) => {
    await assertAdmin(ctx);
    const { supabase, user } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    if (self.role !== 'super') {
      throw new BusinessRuleError('Only super admins can restore landlords');
    }

    const { data: org, error: orgErr } = await supabase
      .from('orgs')
      .select('id, name, deleted_at')
      .eq('id', orgId)
      .maybeSingle();
    if (orgErr) throw new DbError(orgErr);
    if (!org) throw new NotFoundError();
    if (!org.deleted_at) {
      throw new BusinessRuleError('Landlord is not deleted');
    }

    const { error: updErr } = await supabase
      .from('orgs')
      .update({ deleted_at: null })
      .eq('id', orgId);
    if (updErr) throw new DbError(updErr);

    await writeAudit(ctx, {
      event: 'landlord_undeleted',
      targetOrgId: orgId,
      payload: { org_name: org.name },
      critical: true,
    });

    return Response.json({ data: { org_id: orgId, restored: true } });
  },
  { requireAuth: true },
);
