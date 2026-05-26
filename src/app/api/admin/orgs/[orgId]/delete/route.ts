import { z } from 'zod';
import { assertAdmin, getAdminSelf, writeAudit } from '@/features/admin/server';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * POST /api/admin/orgs/[orgId]/delete
 * Body: { reason: string }
 *
 * Soft-deletes a landlord org by stamping `orgs.deleted_at`. Only
 * super admins may run this and only on orgs whose subscription is
 * already `canceled` (i.e. fully suspended). The list page hides
 * deleted orgs by default; `?show_deleted=1` reveals them.
 */

const Body = z
  .object({
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const POST = handler<{ orgId: string }>(
  async (ctx, { orgId }) => {
    await assertAdmin(ctx);
    const { supabase, user, req } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    if (self.role !== 'super') {
      throw new BusinessRuleError('Only super admins can delete landlords');
    }

    const json = await req.json().catch(() => ({}));
    const input = Body.parse(json);

    const { data: org, error: orgErr } = await supabase
      .from('orgs')
      .select('id, name, deleted_at')
      .eq('id', orgId)
      .maybeSingle();
    if (orgErr) throw new DbError(orgErr);
    if (!org) throw new NotFoundError();
    if (org.deleted_at) {
      throw new BusinessRuleError('Landlord is already deleted');
    }

    const { data: sub } = await supabase
      .from('org_subscriptions')
      .select('status')
      .eq('org_id', orgId)
      .maybeSingle();
    if (sub && sub.status !== 'canceled') {
      throw new BusinessRuleError('Suspend the landlord before deleting');
    }

    const { error: delErr } = await supabase
      .from('orgs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', orgId);
    if (delErr) throw new DbError(delErr);

    await writeAudit(ctx, {
      event: 'landlord_deleted',
      targetOrgId: orgId,
      payload: { reason: input.reason, org_name: org.name },
      critical: true,
    });

    return Response.json({ data: { org_id: orgId, deleted: true } });
  },
  { requireAuth: true },
);
