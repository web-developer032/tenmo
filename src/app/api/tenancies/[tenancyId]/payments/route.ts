import { ManualPaymentInput } from '@/core/schemas/rent';
import { listRentPayments, recordManualPayment } from '@/features/rent/server';
import { handler, requireUser } from '@/lib/handler';

/**
 * GET  /api/tenancies/[tenancyId]/payments — list payments
 * POST /api/tenancies/[tenancyId]/payments — record a manual payment
 *
 * RLS keeps tenant access read-only; landlord-roles can record manual
 * payments. The DB does the role check, we just forward the request.
 */
export const GET = handler<{ tenancyId: string }>(
  async (ctx, params) => {
    const payments = await listRentPayments(ctx, { tenancy_id: params.tenancyId });
    return Response.json({ data: payments });
  },
  { requireAuth: true },
);

export const POST = handler<{ tenancyId: string }>(
  async (ctx, params) => {
    const user = requireUser(ctx);
    const json = await ctx.req.json().catch(() => ({}));
    const input = ManualPaymentInput.parse(json);

    const result = await recordManualPayment(ctx, params.tenancyId, input, user);
    return Response.json({ data: result }, { status: 201 });
  },
  { requireAuth: true },
);
