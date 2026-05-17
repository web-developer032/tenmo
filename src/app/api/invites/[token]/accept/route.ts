import { acceptInvite } from '@/features/tenancies/server';
import { handler } from '@/lib/handler';

/**
 * POST /api/invites/[token]/accept — authenticated tenant claims an invite.
 *
 * Tenants are NEVER charged. This endpoint never touches billing.
 */
export const POST = handler<{ token: string }>(
  async (ctx, params) => {
    const tenancy = await acceptInvite(ctx, params.token);
    return Response.json({ data: tenancy });
  },
  { requireAuth: true },
);
