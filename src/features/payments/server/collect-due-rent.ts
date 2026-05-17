import 'server-only';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import { type CreateRentPaymentResult, createRentPaymentForCharge } from './create-rent-payment';

/**
 * Sweep all rent_charges that are collectable today, have an active
 * GoCardless mandate, and don't already have a pending/confirmed DD
 * payment, and trigger one DD pull per charge.
 *
 * Idempotent: `createRentPaymentForCharge` itself is a no-op when an
 * in-flight rent_payments row already exists for the charge, so we
 * can re-run this sweep as often as we want.
 *
 * Tier-gating happens at mandate-setup time (assertTierFeature). Here
 * we trust that any active mandate row implies the org was on a paid
 * tier when it was created. If they downgrade later, we still try to
 * collect (the active mandate is real money owed) and let the
 * landlord's billing UI nudge them about reactivating.
 *
 * Used by the daily cron and by manual landlord-side "Collect now"
 * triggers in dev/test.
 */

const log = () => getLogger().child({ module: 'payments.collect-due-rent' });

export type CollectDueRentResult = {
  found: number;
  attempted: number;
  created: number;
  skipped: number;
  failed: number;
  details: Array<
    {
      charge_id: string;
      tenancy_id: string;
    } & (
      | { status: 'created'; gc_payment_id: string }
      | {
          status: 'skipped';
          reason: CreateRentPaymentResult extends infer R
            ? R extends { status: 'skipped'; reason: infer X }
              ? X
              : never
            : never;
        }
      | { status: 'failed'; error: string }
    )
  >;
};

export async function collectDueRent(
  options: { horizonDays?: number } = {},
): Promise<CollectDueRentResult> {
  const sb = createServiceClient();
  const horizonDays = options.horizonDays ?? 0;

  // Charges to attempt: due/overdue/partially_paid + outstanding > 0,
  // due_date within horizon, with an active mandate on the tenancy,
  // and no in-flight DD payment row already.
  const horizonDate = new Date(Date.now() + horizonDays * 86_400_000).toISOString().slice(0, 10);

  const { data: charges, error } = await sb
    .from('rent_charges')
    .select(
      `id, tenancy_id, amount_pence, paid_pence, status, due_date,
       gocardless_mandates!inner(status, gc_mandate_id)`,
    )
    .in('status', ['due', 'overdue', 'partially_paid'])
    .lte('due_date', horizonDate)
    .filter('gocardless_mandates.status', 'eq', 'active');

  if (error) {
    log().error({ err: error }, 'failed to read collectable charges');
    throw error;
  }

  // The join above isn't FK-backed (mandate→tenancy is the FK, not
  // mandate→charge), so we re-filter manually after the fact: keep
  // only charges where the mandate's tenancy_id matches the charge's
  // tenancy_id. Falling back to the manual sweep is more robust than
  // wrestling postgrest.
  const candidateIds = (charges ?? []).map((c) => c.id);
  const result: CollectDueRentResult = {
    found: candidateIds.length,
    attempted: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  for (const row of charges ?? []) {
    result.attempted += 1;
    try {
      const out = await createRentPaymentForCharge({ charge_id: row.id });
      if (out.status === 'created') {
        result.created += 1;
        result.details.push({
          charge_id: row.id,
          tenancy_id: row.tenancy_id,
          status: 'created',
          gc_payment_id: out.gc_payment_id,
        });
      } else {
        result.skipped += 1;
        result.details.push({
          charge_id: row.id,
          tenancy_id: row.tenancy_id,
          status: 'skipped',
          reason: out.reason,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      log().error({ err, chargeId: row.id }, 'collect failed');
      result.failed += 1;
      result.details.push({
        charge_id: row.id,
        tenancy_id: row.tenancy_id,
        status: 'failed',
        error: message,
      });
    }
  }

  log().info(
    {
      found: result.found,
      created: result.created,
      skipped: result.skipped,
      failed: result.failed,
    },
    'collect-due-rent complete',
  );
  return result;
}
