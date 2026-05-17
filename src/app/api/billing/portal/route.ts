import { CreatePortalInput } from '@/core/schemas/billing';
import { createPortalSession } from '@/features/billing/server';
import { handler } from '@/lib/handler';

/**
 * POST /api/billing/portal — create a Stripe Customer Portal session
 * so the owner can manage card / invoices / cancellation.
 *
 * Body: `{ org_id }`. Returns: `{ url }`.
 */
export const POST = handler(
  async (ctx) => {
    const input = CreatePortalInput.parse(await ctx.req.json());
    const origin = ctx.req.nextUrl.origin;
    const result = await createPortalSession(ctx, input, origin);
    return Response.json({ data: result });
  },
  { requireAuth: true },
);
