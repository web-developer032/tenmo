import { CollectChargeInput } from '@/core/schemas/payments';
import { assertTierFeature } from '@/features/billing/server';
import { createRentPaymentForCharge } from '@/features/payments/server';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { assertOrgMember, handler } from '@/lib/handler';

/**
 * POST /api/payments/charges/[chargeId]/collect — landlord triggers a
 * one-off DD pull against an outstanding rent_charges row.
 *
 * Used for:
 *   - Manual mid-cycle collection (a tenant asks to pay early).
 *   - Retry after a failed pull (the tenant sorted their bank).
 *
 * Owner|agent|staff of the charge's org. Tier-gated on
 * `rent_collection_dd` (Free orgs get a 422 even if a mandate exists).
 */
export const POST = handler<{ chargeId: string }>(
  async (ctx, params) => {
    const { data: charge, error } = await ctx.supabase
      .from('rent_charges')
      .select('id, org_id')
      .eq('id', params.chargeId)
      .maybeSingle();
    if (error) throw new DbError(error);
    if (!charge) throw new AppError(404, ErrorCode.not_found, 'Charge not found');

    await assertOrgMember(ctx, charge.org_id, ['owner', 'agent', 'staff']);
    await assertTierFeature(charge.org_id, 'rent_collection_dd');

    const input = CollectChargeInput.parse(await ctx.req.json().catch(() => ({})));
    const result = await createRentPaymentForCharge({
      charge_id: charge.id,
      amount_pence: input.amount_pence,
      charge_date: input.charge_date,
    });

    if (result.status === 'skipped') {
      return Response.json(
        { data: result, warning: `Collection skipped: ${result.reason}` },
        { status: 202 },
      );
    }
    return Response.json({ data: result }, { status: 201 });
  },
  { requireAuth: true },
);
