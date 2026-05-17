import type { SubscriptionOverrideInput } from '@/core/schemas/admin';
import { DbError, NotFoundError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { writeAudit } from './write-audit';

/**
 * Manually set (or clear) the subscription tier override for an
 * org. The override sits alongside the Stripe-driven `tier` so a
 * subsequent webhook doesn't quietly stomp the rescue.
 *
 * Always writes a critical audit log row. Failure to log the
 * audit aborts the override (no silent privilege escalations).
 */
export async function overrideSubscription(
  ctx: HandlerContext,
  orgId: string,
  input: SubscriptionOverrideInput,
): Promise<void> {
  const user = requireUser(ctx);

  // Look up current state so the audit log captures both before
  // and after — much easier to reason about than a delta.
  const before = await ctx.supabase
    .from('org_subscriptions')
    .select('tier, status, override_tier, override_reason')
    .eq('org_id', orgId)
    .maybeSingle();
  if (before.error) throw new DbError(before.error);
  if (!before.data) throw new NotFoundError('Subscription row missing for org');

  const isClear = input.tier === null;

  const update = isClear
    ? {
        override_tier: null,
        override_reason: null,
        override_set_by: null,
        override_set_at: null,
      }
    : {
        override_tier: input.tier,
        override_reason: input.reason,
        override_set_by: user.id,
        override_set_at: new Date().toISOString(),
      };

  const { error } = await ctx.supabase.from('org_subscriptions').update(update).eq('org_id', orgId);
  if (error) throw new DbError(error);

  await writeAudit(ctx, {
    event: isClear ? 'subscription_override_cleared' : 'subscription_override_set',
    targetOrgId: orgId,
    payload: {
      reason: input.reason,
      previous: {
        tier: before.data.tier,
        status: before.data.status,
        override_tier: before.data.override_tier,
        override_reason: before.data.override_reason,
      },
      next: {
        override_tier: isClear ? null : input.tier,
      },
    },
    critical: true,
  });
}
