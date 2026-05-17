import { StartMandateInput } from '@/core/schemas/payments';
import { startMandateFlow } from '@/features/payments/server';
import { handler } from '@/lib/handler';

/**
 * POST /api/payments/mandates — start a Direct Debit setup flow.
 *
 * Tenant only (enforced inside `startMandateFlow`). Returns the GC
 * hosted Redirect Flow URL — the browser navigates there, the user
 * enters bank details, GC redirects them back to
 * `/tenant/rent/{tenancyId}/dd-callback?redirect_flow_id=...`.
 *
 * Body: `{ tenancy_id }`. Returns `{ redirect_url, mandate_id }`.
 */
export const POST = handler(
  async (ctx) => {
    const input = StartMandateInput.parse(await ctx.req.json());
    const origin = ctx.req.nextUrl.origin;
    const result = await startMandateFlow(ctx, input.tenancy_id, origin);
    return Response.json({ data: result });
  },
  { requireAuth: true },
);
