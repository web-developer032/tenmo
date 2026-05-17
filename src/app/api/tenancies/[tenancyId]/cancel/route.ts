import { cancelTenancyInvite } from '@/features/tenancies/server';
import { handler } from '@/lib/handler';

/**
 * POST /api/tenancies/[tenancyId]/cancel — landlord cancels a pending invite.
 * Permission is enforced by the underlying SQL RPC + RLS policies.
 */
export const POST = handler<{ tenancyId: string }>(
  async (ctx, params) => {
    const tenancy = await cancelTenancyInvite(ctx, params.tenancyId);
    return Response.json({ data: tenancy });
  },
  { requireAuth: true },
);
