import { SubscriptionOverrideInput } from '@/core/schemas/admin';
import { assertAdmin, overrideSubscription } from '@/features/admin/server';
import { handler } from '@/lib/handler';

/**
 * POST /api/admin/orgs/[orgId]/subscription-override
 *
 * Set or clear a manual subscription tier override. The body
 * MUST include a `reason` (≥3 chars) so the audit trail captures
 * why the rescue was needed.
 *
 * Body:
 *   { tier: SubscriptionTier | null, reason: string }
 *
 *   tier=null clears the override.
 */
export const POST = handler<{ orgId: string }>(
  async (ctx, { orgId }) => {
    await assertAdmin(ctx);
    const body = SubscriptionOverrideInput.parse(await ctx.req.json());
    await overrideSubscription(ctx, orgId, body);
    return Response.json({ data: { ok: true } });
  },
  { requireAuth: true },
);
