import { z } from 'zod';
import { assertTierFeature } from '@/features/billing/server';
import { createTrueLayerPaymentForCharge } from '@/features/payments/server';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { assertOrgMember, handler } from '@/lib/handler';

/**
 * POST /api/payments/charges/[chargeId]/truelayer
 *
 * Initiate a TrueLayer Open Banking payment for an outstanding rent charge.
 * Returns a `payment_link` the client redirects the tenant to; the tenant
 * authorises the payment via their bank and is then redirected back to
 * `return_uri`.
 *
 * The payment lifecycle is reconciled by:
 *   1. `/api/payments/truelayer/return?payment_id=…` — polled after redirect.
 *   2. `/api/webhooks/truelayer` — TrueLayer fires events as the bank settles.
 *
 * Auth: any org member of the charge's org (tenants will use a separate
 * dedicated route in v1.1 — for now landlords trigger this on behalf of a
 * tenant who asked to pay by bank).
 */

const Body = z.object({
  /** Defaults to outstanding balance when omitted. */
  amount_pence: z.number().int().positive().optional(),
  /** Where the tenant lands once the bank flow ends. */
  return_uri: z.string().url(),
  /** Beneficiary (landlord platform) bank details. */
  beneficiary_name: z.string().trim().min(2).max(120),
  beneficiary_sort_code: z.string().regex(/^[0-9]{6}$/, 'Sort code must be 6 digits'),
  beneficiary_account_number: z
    .string()
    .regex(/^[0-9]{8}$/, 'Account number must be 8 digits'),
});

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
    // Reuse the DD tier flag — Open Banking is part of the same paid-tier
    // rent-collection bundle. Free tenants pay manually offline.
    await assertTierFeature(charge.org_id, 'rent_collection_dd');

    const input = Body.parse(await ctx.req.json().catch(() => ({})));
    const result = await createTrueLayerPaymentForCharge({
      charge_id: charge.id,
      amount_pence: input.amount_pence,
      return_uri: input.return_uri,
      beneficiary_name: input.beneficiary_name,
      beneficiary_sort_code: input.beneficiary_sort_code,
      beneficiary_account_number: input.beneficiary_account_number,
    });

    if (result.status === 'skipped') {
      return Response.json(
        { data: result, warning: `Payment skipped: ${result.reason}` },
        { status: 202 },
      );
    }
    return Response.json({ data: result }, { status: 201 });
  },
  { requireAuth: true },
);
