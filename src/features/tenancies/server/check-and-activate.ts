import 'server-only';
import { type ActivationDecision, deriveActivationBlockers } from '@/core/utils/tenancy-activation';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Check whether a tenancy is ready to activate, and if so, flip
 * `tenancies.status` to `active`.
 *
 * Called from:
 *   - The DocuSeal webhook reconciler when AST completes.
 *   - The GoCardless webhook (mandate active doesn't activate
 *     tenancies but it's a logical re-check point if you want it).
 *   - The daily Inngest cron `tenancy/check-and-activate` (catches
 *     start-date crossings + RTR / deposit changes outside the
 *     webhook flow).
 *   - Manual landlord trigger from the activation checklist UI.
 *
 * Service-role client throughout so it works inside webhooks.
 *
 * Idempotent — calling on an already-active tenancy is a no-op.
 */

const log = () => getLogger().child({ module: 'tenancy.check-and-activate' });

export interface CheckAndActivateResult {
  tenancy_id: string;
  /** True when this call moved the tenancy to `active`. */
  activated: boolean;
  /** True when the tenancy was already active. */
  already_active: boolean;
  decision: ActivationDecision;
}

export async function checkAndActivateTenancy(tenancyId: string): Promise<CheckAndActivateResult> {
  const sb = createServiceClient();

  const { data: tenancy, error } = await sb
    .from('tenancies')
    .select(
      `id, status, tenant_user_id, ast_signed_at, deposit_pence,
       deposit_protected_at, start_date`,
    )
    .eq('id', tenancyId)
    .maybeSingle();
  if (error) throw error;
  if (!tenancy) {
    return {
      tenancy_id: tenancyId,
      activated: false,
      already_active: false,
      decision: { canActivate: false, blockers: [] },
    };
  }

  if (tenancy.status === 'active') {
    return {
      tenancy_id: tenancyId,
      activated: false,
      already_active: true,
      decision: { canActivate: true, blockers: [] },
    };
  }

  const rtrCurrent = await readRtrCurrent(tenancyId);

  const decision = deriveActivationBlockers({
    tenant_user_id: tenancy.tenant_user_id,
    ast_signed_at: tenancy.ast_signed_at,
    deposit_pence: tenancy.deposit_pence,
    deposit_protected_at: tenancy.deposit_protected_at,
    rtr_current: rtrCurrent,
    start_date: tenancy.start_date,
  });

  if (!decision.canActivate) {
    log().info(
      { tenancyId, blockers: decision.blockers.map((b) => b.code) },
      'tenancy not ready to activate',
    );
    return { tenancy_id: tenancyId, activated: false, already_active: false, decision };
  }

  const { error: updErr } = await sb
    .from('tenancies')
    .update({ status: 'active' })
    .eq('id', tenancyId)
    .neq('status', 'active');
  if (updErr) {
    log().error({ err: updErr, tenancyId }, 'tenancy activation update failed');
    throw updErr;
  }

  log().info({ tenancyId }, 'tenancy activated');
  return { tenancy_id: tenancyId, activated: true, already_active: false, decision };
}

async function readRtrCurrent(tenancyId: string): Promise<boolean> {
  const sb = createServiceClient();
  // RTR check is stored as a `compliance_items` row of type
  // `right_to_rent`. The status column is one of
  // `ok | due_soon | overdue | unknown` (see Phase D migration).
  // We accept `ok` or `due_soon` (still in date), reject `overdue`
  // and `unknown` (no record). Tenancy-scoped rows take priority
  // over property-scoped ones — the landlord may have set it
  // either place.
  const { data: items } = await sb
    .from('compliance_items')
    .select('status, expires_at, tenancy_id')
    .eq('type', 'right_to_rent')
    .eq('tenancy_id', tenancyId);
  if (!items || items.length === 0) return false;

  const today = new Date();
  for (const item of items) {
    if (item.status === 'overdue' || item.status === 'unknown') continue;
    if (item.expires_at && new Date(item.expires_at) < today) continue;
    return true;
  }
  return false;
}
