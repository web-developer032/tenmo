import { z } from 'zod';
import { assertAdmin, getAdminSelf } from '@/features/admin/server';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Suspend / reinstate a landlord org.
 *
 * Suspension flips `org_subscriptions.status` to `canceled` and sets
 * `override_tier = 'free'` so tier-limit checks immediately enforce
 * the free tier. Reinstating clears the override and restores the
 * previous tier as best we can.
 *
 * Allowed roles: super, support.
 */

const Body = z
  .object({
    action: z.enum(['suspend', 'reinstate']),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export const POST = handler<{ orgId: string }>(
  async (ctx, params) => {
    await assertAdmin(ctx);
    const { supabase, user, req, log } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    if (!['super', 'support'].includes(self.role)) {
      throw new BusinessRuleError('Insufficient role to suspend landlords');
    }

    const json = await req.json().catch(() => ({}));
    const input = Body.parse(json);
    const orgId = params.orgId;

    const { data: sub, error: subErr } = await supabase
      .from('org_subscriptions')
      .select('tier, status, override_tier')
      .eq('org_id', orgId)
      .maybeSingle();
    if (subErr) throw new DbError(subErr);
    if (!sub) throw new NotFoundError();

    const updates =
      input.action === 'suspend'
        ? {
            status: 'canceled' as const,
            override_tier: 'free' as const,
            canceled_at: new Date().toISOString(),
          }
        : {
            status: 'active' as const,
            override_tier: null,
            canceled_at: null,
          };

    const { error: updErr } = await supabase
      .from('org_subscriptions')
      .update(updates)
      .eq('org_id', orgId);
    if (updErr) {
      log.error({ err: updErr }, 'org suspend update failed');
      throw new DbError(updErr);
    }

    const event = input.action === 'suspend' ? 'landlord_suspended' : 'landlord_reinstated';

    const { error: auditErr } = await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event,
      target_org_id: orgId,
      payload: { reason: input.reason ?? null },
    });
    if (auditErr) throw new DbError(auditErr);

    return Response.json({ data: { action: input.action, org_id: orgId } });
  },
  { requireAuth: true },
);
