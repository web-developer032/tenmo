import { CreateCheckoutInput } from '@/core/schemas/billing';
import { createCheckoutSession } from '@/features/billing/server';
import { handler } from '@/lib/handler';

/**
 * POST /api/billing/checkout — create a Stripe Checkout session for an
 * org-tier upgrade. Owner-only (enforced inside the server module).
 *
 * Body: `{ org_id, tier, interval }` (interval defaults to 'monthly').
 * Returns: `{ url }` — the browser redirects there.
 */
export const POST = handler(
  async (ctx) => {
    const input = CreateCheckoutInput.parse(await ctx.req.json());
    const origin = ctx.req.nextUrl.origin;
    const result = await createCheckoutSession(ctx, input, origin);
    return Response.json({ data: result });
  },
  { requireAuth: true },
);
