import 'server-only';
import { canCollect, outstandingPence } from '@/core/utils/payment-rules';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { createPayment as gcCreatePayment } from '@/lib/gocardless/client';
import type { GcPayment } from '@/lib/gocardless/types';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Create a one-off GoCardless DD payment for a single rent_charges row.
 *
 * Used by:
 *   - The landlord-side `POST /api/payments/charges/[chargeId]/collect`
 *     handler (manual / mid-cycle collection).
 *   - The monthly cron after `generateRentCharges` produces a charge.
 *
 * Idempotency:
 *   - We use `Idempotency-Key: rent-charge-{chargeId}` on the GC call —
 *     repeating collection for the same charge always returns the same
 *     GC payment row.
 *   - We also insert the `rent_payments` row immediately and link it
 *     by `external_id = gc_payment.id` so a webhook arriving before
 *     this insert finishes can still find us via the unique key.
 *   - We never double-create a `rent_payments` row for the same charge
 *     by checking for an existing row with `method='gocardless_dd'` +
 *     `status in ('pending','confirmed')` first.
 *
 * Tier-gating happens at the API layer (assertTierFeature), not here,
 * so the cron can call this freely once the org passed the gate at
 * mandate-setup time.
 */

const log = () => getLogger().child({ module: 'payments.create-rent-payment' });

export type CreateRentPaymentResult =
  | { status: 'created'; payment_id: string; gc_payment_id: string }
  | { status: 'skipped'; reason: 'no_mandate' | 'already_pending' | 'already_paid' };

export interface CreateRentPaymentInput {
  charge_id: string;
  /** Override outstanding-balance amount. Defaults to outstanding pence. */
  amount_pence?: number;
  charge_date?: string;
}

export async function createRentPaymentForCharge(
  input: CreateRentPaymentInput,
): Promise<CreateRentPaymentResult> {
  const sb = createServiceClient();

  const { data: charge, error: chgErr } = await sb
    .from('rent_charges')
    .select('id, org_id, tenancy_id, amount_pence, paid_pence, status, period_start')
    .eq('id', input.charge_id)
    .maybeSingle();
  if (chgErr) throw new DbError(chgErr);
  if (!charge) throw new AppError(404, ErrorCode.not_found, 'Charge not found');

  const outstanding = outstandingPence(charge);
  if (outstanding <= 0 || charge.status === 'paid') {
    return { status: 'skipped', reason: 'already_paid' };
  }
  const amount = Math.min(input.amount_pence ?? outstanding, outstanding);

  const { data: existingPayment } = await sb
    .from('rent_payments')
    .select('id, status, external_id')
    .eq('charge_id', input.charge_id)
    .eq('method', 'gocardless_dd')
    .in('status', ['pending', 'confirmed'])
    .maybeSingle();
  if (existingPayment) {
    return { status: 'skipped', reason: 'already_pending' };
  }

  const { data: mandateRow, error: manErr } = await sb.rpc('active_mandate_for_tenancy', {
    p_tenancy_id: charge.tenancy_id,
  });
  if (manErr) throw new DbError(manErr);
  const mandate = Array.isArray(mandateRow) ? mandateRow[0] : null;
  if (!mandate || !canCollect(mandate)) {
    return { status: 'skipped', reason: 'no_mandate' };
  }

  const description = `Rent ${charge.period_start}`.slice(0, 100);

  let gcPayment: GcPayment;
  try {
    gcPayment = await gcCreatePayment(
      {
        amount,
        currency: 'GBP',
        description,
        charge_date: input.charge_date,
        metadata: {
          charge_id: charge.id,
          tenancy_id: charge.tenancy_id,
          org_id: charge.org_id,
        },
        links: { mandate: mandate.gc_mandate_id as string },
      },
      `rent-charge-${charge.id}`,
    );
  } catch (err) {
    log().error({ err, chargeId: charge.id }, 'gc payment create failed');
    throw err;
  }

  const { data: inserted, error: insErr } = await sb
    .from('rent_payments')
    .insert({
      org_id: charge.org_id,
      tenancy_id: charge.tenancy_id,
      charge_id: charge.id,
      amount_pence: amount,
      method: 'gocardless_dd' as const,
      status: 'pending' as const,
      external_id: gcPayment.id,
    })
    .select('id')
    .single();
  if (insErr || !inserted) {
    log().error(
      { err: insErr, chargeId: charge.id, gcPaymentId: gcPayment.id },
      'rent_payments insert failed (GC payment is live)',
    );
    throw new DbError(insErr ?? 'no row returned');
  }

  return { status: 'created', payment_id: inserted.id, gc_payment_id: gcPayment.id };
}
