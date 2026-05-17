import { TenancyEnd } from '@/core/schemas/tenancy';
import { endTenancy } from '@/features/tenancies/server';
import { handler } from '@/lib/handler';

/**
 * POST /api/tenancies/[tenancyId]/end — landlord ends a tenancy.
 *
 * The body is validated against `TenancyEnd` and the server module enforces
 * the Renters' Rights Bill notice floor for the chosen reason.
 */
export const POST = handler<{ tenancyId: string }>(
  async (ctx, params) => {
    const json = await ctx.req.json().catch(() => ({}));
    const input = TenancyEnd.parse(json);
    const tenancy = await endTenancy(ctx, params.tenancyId, input);
    return Response.json({ data: tenancy });
  },
  { requireAuth: true },
);
