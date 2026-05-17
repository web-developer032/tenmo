import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Generate the next billing-period charges for active tenancies whose
 * `period_start` falls within the horizon.
 *
 * Idempotent: the unique index on (tenancy_id, period_start) makes
 * re-runs safe — a duplicate insert simply returns 23505 and is skipped.
 *
 * Used by:
 *   - the daily rent cron (`/api/cron/rent-monthly-charges`)
 *   - manual landlord trigger (rent ledger "Issue next charge" button)
 */
export type GenerateChargesResult = {
  found: number;
  created: number;
  skipped: number;
  failed: number;
  swept_overdue: number;
  details: Array<{
    tenancyId: string;
    periodStart: string;
    status: 'created' | 'skipped' | 'failed';
    error?: string;
  }>;
};

type DueChargeRow = {
  tenancy_id: string;
  org_id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  amount_pence: number;
};

export async function generateRentCharges(
  options: { horizonDays?: number; client?: SupabaseClient } = {},
): Promise<GenerateChargesResult> {
  const log = getLogger().child({ module: 'rent.cron' });
  const supabase = options.client ?? createServiceClient();
  const horizon = options.horizonDays ?? 7;

  const { data, error } = await supabase.rpc('due_rent_charges', {
    p_horizon_days: horizon,
  });
  if (error) {
    log.error({ err: error }, 'due_rent_charges rpc failed');
    throw error;
  }

  const due = (data ?? []) as DueChargeRow[];
  log.info({ horizon, count: due.length }, 'rent charges due');

  const result: GenerateChargesResult = {
    found: due.length,
    created: 0,
    skipped: 0,
    failed: 0,
    swept_overdue: 0,
    details: [],
  };

  for (const row of due) {
    const status = row.due_date < new Date().toISOString().slice(0, 10) ? 'overdue' : 'due';

    const { error: insertErr } = await supabase.from('rent_charges').insert({
      org_id: row.org_id,
      tenancy_id: row.tenancy_id,
      period_start: row.period_start,
      period_end: row.period_end,
      due_date: row.due_date,
      amount_pence: row.amount_pence,
      status,
    });

    if (insertErr) {
      if (insertErr.code === '23505') {
        result.skipped += 1;
        result.details.push({
          tenancyId: row.tenancy_id,
          periodStart: row.period_start,
          status: 'skipped',
          error: 'already_exists',
        });
        continue;
      }
      log.error({ err: insertErr, tenancyId: row.tenancy_id }, 'failed to create rent charge');
      result.failed += 1;
      result.details.push({
        tenancyId: row.tenancy_id,
        periodStart: row.period_start,
        status: 'failed',
        error: insertErr.message,
      });
      continue;
    }

    result.created += 1;
    result.details.push({
      tenancyId: row.tenancy_id,
      periodStart: row.period_start,
      status: 'created',
    });
  }

  // Sweep any charges that have just rolled past their due date.
  const { data: sweptCount, error: sweepErr } = await supabase.rpc('sweep_overdue_rent_charges');
  if (sweepErr) {
    log.error({ err: sweepErr }, 'sweep_overdue_rent_charges failed');
  } else {
    result.swept_overdue = Number(sweptCount ?? 0);
  }

  log.info(
    {
      found: result.found,
      created: result.created,
      skipped: result.skipped,
      failed: result.failed,
      sweptOverdue: result.swept_overdue,
    },
    'rent charge run complete',
  );
  return result;
}
