import { listRentCharges } from '@/features/rent/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/tenancies/[tenancyId]/charges — list rent charges for a tenancy.
 *
 * RLS scopes results: landlords see their org's tenancies, tenants see only
 * their own. We rely on RLS rather than re-checking here.
 */
export const GET = handler<{ tenancyId: string }>(
  async (ctx, params) => {
    const url = new URL(ctx.req.url);
    const status = url.searchParams.get('status') ?? undefined;

    const charges = await listRentCharges(ctx, {
      tenancy_id: params.tenancyId,
      status: status as Parameters<typeof listRentCharges>[1]['status'],
    });
    return Response.json({ data: charges });
  },
  { requireAuth: true },
);
