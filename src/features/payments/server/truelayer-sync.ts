import 'server-only';
import { type TlPaymentStatusResult, getPaymentStatus } from '@/lib/truelayer';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import { notifyRentFailed, notifyRentPaid } from './notify-payment';

/**
 * Apply a TrueLayer payment status to our local `rent_payments` row.
 *
 * The webhook handler calls this with the IDs from the webhook payload;
 * the worker also calls it after polling the payment status (e.g.
 * when the tenant returned from the bank flow but the webhook hasn't
 * landed yet — TrueLayer can take seconds to minutes to settle).
 *
 * Idempotent: a payment whose status is already `confirmed` does not
 * get its `paid_at` overwritten, and the `notifyRentPaid` call is
 * skipped on the second invocation (the if-changed guard handles it).
 */

const log = () => getLogger().child({ module: 'payments.truelayer.sync' });

export type TruelayerApplyResult =
  | { applied: false; reason: 'unknown_payment' | 'no_change' }
  | { applied: true; kind: 'confirmed' | 'failed' | 'pending' };

const TL_STATUS_MAP: Record<string, 'pending' | 'confirmed' | 'failed'> = {
  authorization_required: 'pending',
  authorizing: 'pending',
  authorized: 'pending',
  executed: 'confirmed',
  settled: 'confirmed',
  failed: 'failed',
};

export async function applyTrueLayerStatus(args: {
  paymentId: string;
  status: TlPaymentStatusResult['status'];
  failureReason?: string | null;
}): Promise<TruelayerApplyResult> {
  const sb = createServiceClient();
  const newStatus = TL_STATUS_MAP[args.status];
  if (!newStatus) {
    log().debug({ status: args.status }, 'unknown truelayer status — ignoring');
    return { applied: false, reason: 'no_change' };
  }

  const { data: row, error } = await sb
    .from('rent_payments')
    .select('id, org_id, tenancy_id, charge_id, amount_pence, status')
    .eq('external_id', args.paymentId)
    .eq('method', 'truelayer_ob')
    .maybeSingle();
  if (error) throw error;
  if (!row) {
    log().warn({ paymentId: args.paymentId }, 'truelayer status for unknown rent_payments row');
    return { applied: false, reason: 'unknown_payment' };
  }

  if (row.status === newStatus) {
    return { applied: false, reason: 'no_change' };
  }

  const update: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'confirmed') {
    update.paid_at = new Date().toISOString();
  }
  if (newStatus === 'failed' && args.failureReason) {
    update.notes = `tl_cause:${args.failureReason}`;
  }

  const { error: updErr } = await sb
    .from('rent_payments')
    .update(update)
    .eq('id', row.id);
  if (updErr) throw updErr;

  if (newStatus === 'confirmed') {
    // FIFO apply to the parent charge.
    const { error: applyErr } = await sb.rpc('apply_payment_to_charges', {
      p_payment_id: row.id,
    });
    if (applyErr) {
      log().error({ err: applyErr, paymentId: row.id }, 'apply_payment_to_charges rpc failed');
    }
    const tenantUserId = await resolveTenantUserId(row.tenancy_id);
    await notifyRentPaid({
      ctx: {
        org_id: row.org_id,
        tenancy_id: row.tenancy_id,
        tenant_user_id: tenantUserId,
      },
      amountPence: row.amount_pence,
    });
  } else if (newStatus === 'failed') {
    const tenantUserId = await resolveTenantUserId(row.tenancy_id);
    await notifyRentFailed({
      ctx: {
        org_id: row.org_id,
        tenancy_id: row.tenancy_id,
        tenant_user_id: tenantUserId,
      },
      amountPence: row.amount_pence,
      cause: args.failureReason ?? null,
    });
  }

  return { applied: true, kind: newStatus };
}

/**
 * Convenience helper: re-fetch the payment status from TrueLayer and
 * apply it. Used by the post-redirect polling endpoint.
 */
export async function pollAndApplyTrueLayerPayment(paymentId: string): Promise<TruelayerApplyResult> {
  const status = await getPaymentStatus(paymentId);
  return applyTrueLayerStatus({
    paymentId,
    status: status.status,
    failureReason: status.failure_reason ?? null,
  });
}

async function resolveTenantUserId(tenancyId: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('tenancies')
    .select('tenant_user_id')
    .eq('id', tenancyId)
    .maybeSingle();
  return (data?.tenant_user_id as string | null) ?? null;
}
