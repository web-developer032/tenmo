import 'server-only';
import { randomUUID } from 'node:crypto';
import { assertTierFeature } from '@/features/billing/server';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { createRedirectFlow } from '@/lib/gocardless/client';
import { type HandlerContext, requireUser } from '@/lib/handler';

/**
 * Start a GoCardless Redirect Flow for a tenancy's Direct Debit setup.
 *
 * Caller must be the tenant of the tenancy. We:
 *   1. Look up the tenancy + verify the caller is its tenant.
 *   2. Tier-gate on the *landlord's* org (Free orgs can't accept DD).
 *   3. Create a Redirect Flow at GC with our success URL pointing to
 *      `/tenant/rent/{tenancyId}/dd-callback`.
 *   4. Persist a `gocardless_mandates` row with `status='pending_submission'`,
 *      stamping the redirect_flow_id so the callback can find us.
 *   5. Return the GC redirect URL — the browser navigates there.
 *
 * Idempotency: if the tenant clicks "Set up DD" twice quickly, we
 * generate a fresh flow each time but reuse the same mandate row by
 * updating it. The session_token is per-flow (random UUID) so GC
 * treats them as distinct.
 */
export async function startMandateFlow(
  ctx: HandlerContext,
  tenancyId: string,
  origin: string,
): Promise<{ redirect_url: string; mandate_id: string }> {
  const user = requireUser(ctx);

  const { data: tenancy, error: tenErr } = await ctx.supabase
    .from('tenancies')
    .select('id, org_id, tenant_user_id, status, rent_pence')
    .eq('id', tenancyId)
    .maybeSingle();
  if (tenErr) throw new DbError(tenErr);
  if (!tenancy) throw new AppError(404, ErrorCode.not_found, 'Tenancy not found');

  if (tenancy.tenant_user_id !== user.id) {
    throw new AppError(403, ErrorCode.forbidden, 'Only the tenant can set up Direct Debit');
  }
  if (tenancy.status !== 'active') {
    throw new AppError(
      422,
      ErrorCode.business_rule_violation,
      'Tenancy is not active — Direct Debit cannot be set up yet.',
    );
  }

  await assertTierFeature(tenancy.org_id, 'rent_collection_dd');

  // Look up an existing mandate row to reuse if present (we keep at
  // most one row per tenancy — see Phase E migration's partial unique
  // index on `tenancy_id where status='active'`).
  const { data: existing, error: exErr } = await ctx.supabase
    .from('gocardless_mandates')
    .select('id, status')
    .eq('tenancy_id', tenancyId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (exErr) throw new DbError(exErr);
  const reusable = existing?.[0];
  if (reusable && reusable.status === 'active') {
    throw new AppError(409, ErrorCode.conflict, 'Direct Debit is already active for this tenancy.');
  }

  const sessionToken = randomUUID();
  const successUrl = `${origin}/tenant/rent/${tenancyId}/dd-callback`;

  const flow = await createRedirectFlow({
    description: `Direct Debit for tenancy ${tenancyId.slice(0, 8)}`,
    session_token: sessionToken,
    success_redirect_url: successUrl,
    metadata: {
      tenancy_id: tenancyId,
      org_id: tenancy.org_id,
      tenant_user_id: user.id,
    },
  });

  const mandateRow = {
    org_id: tenancy.org_id,
    tenancy_id: tenancyId,
    tenant_user_id: user.id,
    gc_redirect_flow_id: flow.id,
    gc_redirect_session_token: sessionToken,
    flow_redirect_url: flow.redirect_url,
    status: 'pending_submission' as const,
    created_by: user.id,
  };

  if (reusable) {
    const { data: updated, error: updErr } = await ctx.supabase
      .from('gocardless_mandates')
      .update({
        gc_redirect_flow_id: flow.id,
        gc_redirect_session_token: sessionToken,
        flow_redirect_url: flow.redirect_url,
        status: 'pending_submission',
      })
      .eq('id', reusable.id)
      .select('id')
      .single();
    if (updErr || !updated) throw new DbError(updErr ?? 'no row returned');
    return { redirect_url: flow.redirect_url, mandate_id: updated.id };
  }

  const { data: inserted, error: insErr } = await ctx.supabase
    .from('gocardless_mandates')
    .insert(mandateRow)
    .select('id')
    .single();
  if (insErr || !inserted) throw new DbError(insErr ?? 'no row returned');

  return { redirect_url: flow.redirect_url, mandate_id: inserted.id };
}
