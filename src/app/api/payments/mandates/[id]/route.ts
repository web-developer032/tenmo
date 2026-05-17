import { cancelMandateForTenancy } from '@/features/payments/server';
import { handler } from '@/lib/handler';

/**
 * DELETE /api/payments/mandates/[id] — cancel an active mandate.
 *
 * Either the tenant who owns it or any landlord-side org member with
 * `owner|agent|staff` may call (enforced inside the server module).
 * Idempotent — calling on an already-cancelled mandate returns the
 * row in its current state without an error.
 */
export const DELETE = handler<{ id: string }>(
  async (ctx, params) => {
    const result = await cancelMandateForTenancy(ctx, params.id);
    return Response.json({ data: result });
  },
  { requireAuth: true },
);
