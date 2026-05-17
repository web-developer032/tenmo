import { CompleteMandateInput } from '@/core/schemas/payments';
import { completeMandateFlow } from '@/features/payments/server';
import { handler } from '@/lib/handler';

/**
 * POST /api/payments/mandates/[id]/complete — finalise a Direct Debit
 * setup flow after the tenant returns from GoCardless.
 *
 * `[id]` is the GC Redirect Flow id (we use it as the lookup key
 * because at the time the browser is on the callback page we don't
 * yet know our internal mandate id). Body just echoes the
 * redirect_flow_id for cross-checking.
 *
 * Tenant-self-only (enforced inside `completeMandateFlow` via the
 * `tenant_user_id = auth.uid()` check on the mandate row).
 */
export const POST = handler<{ id: string }>(
  async (ctx, params) => {
    const body = await ctx.req.json().catch(() => ({}));
    const input = CompleteMandateInput.parse({
      redirect_flow_id: body.redirect_flow_id ?? params.id,
    });
    const result = await completeMandateFlow(ctx, input.redirect_flow_id);
    return Response.json({ data: result });
  },
  { requireAuth: true },
);
