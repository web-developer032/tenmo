import 'server-only';
import { canCollect, outstandingPence } from '@/core/utils/payment-rules';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import { createPayment as tlCreatePayment, type TlPaymentResult } from '@/lib/truelayer';

/**
 * Create a one-off TrueLayer Open Banking payment for a single
 * `rent_charges` row. Used as a fallback / alternative to the
 * GoCardless DD flow when:
 *   - the tenant doesn't want to set up a mandate (one-off payment), or
 *   - the existing mandate is cancelled/failed and we want them to clear
 *     the balance immediately rather than wait for a new mandate.
 *
 * Returns a hosted payment link the tenant is redirected to. The
 * post-redirect handler (`/api/payments/truelayer/return`) and the
 * webhook (`/api/webhooks/truelayer`) both end up calling
 * `applyTrueLayerStatus` from `truelayer-sync.ts`.
 *
 * Pre-conditions:
 *   - The charge has outstanding balance.
 *   - There is no in-flight (pending/confirmed) rent_payment for this charge
 *     already (either via DD or via a previous TL payment).
 *
 * Tier-gating: identical to DD — the platform decides which method to
 * surface to the tenant. We don't gate here so the cron / landlord-side
 * triggers can call freely.
 */

const log = () => getLogger().child({ module: 'payments.truelayer.create' });

export type CreateTlPaymentResult =
  | {
      status: 'created';
      payment_id: string;
      tl_payment_id: string;
      payment_link: string;
    }
  | {
      status: 'skipped';
      reason: 'already_pending' | 'already_paid';
    };

export interface CreateTrueLayerPaymentInput {
  charge_id: string;
  amount_pence?: number;
  return_uri: string;
  /** Beneficiary account holder name shown on the bank page. */
  beneficiary_name: string;
  /** Beneficiary sort code (no dashes). */
  beneficiary_sort_code: string;
  /** Beneficiary account number (8 digits). */
  beneficiary_account_number: string;
}

export async function createTrueLayerPaymentForCharge(
  input: CreateTrueLayerPaymentInput,
): Promise<CreateTlPaymentResult> {
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
    .select('id, status, method')
    .eq('charge_id', input.charge_id)
    .in('status', ['pending', 'confirmed'])
    .maybeSingle();
  if (existingPayment) {
    return { status: 'skipped', reason: 'already_pending' };
  }

  const reference = `rent-${charge.id.slice(0, 12)}`;
  const description = `Rent ${charge.period_start}`.slice(0, 100);

  let tlPayment: TlPaymentResult;
  try {
    tlPayment = await tlCreatePayment({
      amount_pence: amount,
      reference,
      description,
      sort_code: input.beneficiary_sort_code,
      account_number: input.beneficiary_account_number,
      beneficiary_name: input.beneficiary_name,
      return_uri: input.return_uri,
      metadata: {
        charge_id: charge.id,
        tenancy_id: charge.tenancy_id,
        org_id: charge.org_id,
      },
    });
  } catch (err) {
    log().error({ err, chargeId: charge.id }, 'truelayer payment create failed');
    throw err;
  }

  const { data: inserted, error: insErr } = await sb
    .from('rent_payments')
    .insert({
      org_id: charge.org_id,
      tenancy_id: charge.tenancy_id,
      charge_id: charge.id,
      amount_pence: amount,
      method: 'truelayer_ob' as const,
      status: 'pending' as const,
      external_id: tlPayment.id,
    })
    .select('id')
    .single();
  if (insErr || !inserted) {
    log().error(
      { err: insErr, chargeId: charge.id, tlPaymentId: tlPayment.id },
      'rent_payments insert failed (TL payment is live)',
    );
    throw new DbError(insErr ?? 'no row returned');
  }

  return {
    status: 'created',
    payment_id: inserted.id,
    tl_payment_id: tlPayment.id,
    payment_link: tlPayment.payment_link,
  };
}

// Re-export from canCollect helper to keep the public symbol set tight in case
// future callers want to gate by mandate state — not used for TL today.
export { canCollect };
