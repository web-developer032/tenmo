import 'server-only';
import { type ManualPaymentInput, RentPayment } from '@/core/schemas/rent';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

export type RecordManualPaymentResult = {
  payment: ReturnType<typeof RentPayment.parse>;
  applied_charge_ids: string[];
};

/**
 * Record a manual rent payment for a tenancy.
 *
 * Flow:
 *   1. Resolve `org_id` from the tenancy (RLS will reject if the caller can't
 *      see the tenancy at all).
 *   2. Insert the payment as `confirmed` (manual entries don't sit pending).
 *   3. Allocate via `apply_payment_to_charges` so the open charges' paid_pence
 *      and status are updated.
 */
export async function recordManualPayment(
  ctx: HandlerContext,
  tenancyId: string,
  input: ManualPaymentInput,
  user: { id: string },
): Promise<RecordManualPaymentResult> {
  if (input.amount_pence <= 0) {
    throw new BusinessRuleError('Payment amount must be positive');
  }

  const { data: tenancy, error: tenancyErr } = await ctx.supabase
    .from('tenancies')
    .select('id, org_id, status')
    .eq('id', tenancyId)
    .maybeSingle();

  if (tenancyErr) throw new DbError(tenancyErr);
  if (!tenancy) throw new NotFoundError('Tenancy not found');

  if (tenancy.status === 'cancelled') {
    throw new BusinessRuleError('Cannot record a payment on a cancelled tenancy');
  }

  if (input.charge_id) {
    const { data: charge, error: chargeErr } = await ctx.supabase
      .from('rent_charges')
      .select('id, tenancy_id')
      .eq('id', input.charge_id)
      .maybeSingle();
    if (chargeErr) throw new DbError(chargeErr);
    if (!charge || charge.tenancy_id !== tenancyId) {
      throw new BusinessRuleError('Charge does not belong to this tenancy');
    }
  }

  const paidAt = input.paid_at
    ? new Date(input.paid_at).toISOString()
    : input.paid_on
      ? new Date(`${input.paid_on}T12:00:00Z`).toISOString()
      : new Date().toISOString();

  const { data: payment, error: paymentErr } = await ctx.supabase
    .from('rent_payments')
    .insert({
      org_id: tenancy.org_id,
      tenancy_id: tenancyId,
      charge_id: input.charge_id ?? null,
      amount_pence: input.amount_pence,
      method: input.method,
      status: 'confirmed',
      paid_at: paidAt,
      notes: input.notes ?? null,
      recorded_by: user.id,
    })
    .select('*')
    .single();

  if (paymentErr) throw new DbError(paymentErr);

  const { data: applied, error: applyErr } = await ctx.supabase.rpc('apply_payment_to_charges', {
    p_payment_id: payment.id,
  });
  if (applyErr) {
    ctx.log.error({ err: applyErr, paymentId: payment.id }, 'apply_payment_to_charges failed');
    throw new DbError(applyErr);
  }

  return {
    payment: RentPayment.parse(payment),
    applied_charge_ids: (applied as string[] | null) ?? [],
  };
}
