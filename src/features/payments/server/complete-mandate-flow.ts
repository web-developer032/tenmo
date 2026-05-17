import 'server-only';
import { GoCardlessMandate } from '@/core/schemas/payments';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { completeRedirectFlow } from '@/lib/gocardless/client';
import { type HandlerContext, requireUser } from '@/lib/handler';

/**
 * Complete a Redirect Flow after the tenant returns from GoCardless.
 *
 * Caller must be the tenant who initiated the flow (we verify by
 * matching `tenant_user_id` on the mandate row).
 *
 * Flow:
 *   1. Look up our mandate row by `gc_redirect_flow_id` (set in
 *      start-mandate-flow.ts).
 *   2. Replay the persisted `gc_redirect_session_token` to GC's
 *      `/redirect_flows/{id}/actions/complete` endpoint — GC requires
 *      the same value we sent at create-time.
 *   3. Persist `gc_customer_id`, `gc_mandate_id`, status='submitted'.
 *      The webhook handler will flip to 'active' once GC confirms.
 *
 * Notes:
 *   - We don't move straight to 'active' here even though the flow
 *     completed — GC will send `mandates.created` then
 *     `mandates.submitted` and finally `mandates.active`. Treat the
 *     webhook as the source of truth.
 *   - Idempotent: completing the same flow twice returns the same row.
 */
export async function completeMandateFlow(
  ctx: HandlerContext,
  redirectFlowId: string,
): Promise<GoCardlessMandate> {
  const user = requireUser(ctx);

  const { data: mandate, error: lookupErr } = await ctx.supabase
    .from('gocardless_mandates')
    .select('*')
    .eq('gc_redirect_flow_id', redirectFlowId)
    .maybeSingle();
  if (lookupErr) throw new DbError(lookupErr);
  if (!mandate) {
    throw new AppError(404, ErrorCode.not_found, 'Direct Debit flow not found');
  }
  if (mandate.tenant_user_id !== user.id) {
    throw new AppError(403, ErrorCode.forbidden, 'Only the tenant can complete this flow');
  }

  // Idempotent path: already completed.
  if (mandate.gc_mandate_id) {
    return GoCardlessMandate.parse(mandate);
  }

  if (!mandate.gc_redirect_session_token) {
    throw new AppError(
      500,
      ErrorCode.internal_error,
      'Mandate is missing its session token; restart the Direct Debit setup.',
    );
  }

  const completed = await completeRedirectFlow(redirectFlowId, {
    session_token: mandate.gc_redirect_session_token,
  });

  const gcCustomerId = completed.links.customer ?? null;
  const gcMandateId = completed.links.mandate ?? null;

  const { data: updated, error: updErr } = await ctx.supabase
    .from('gocardless_mandates')
    .update({
      gc_customer_id: gcCustomerId,
      gc_mandate_id: gcMandateId,
      status: 'submitted',
    })
    .eq('id', mandate.id)
    .select('*')
    .single();
  if (updErr || !updated) throw new DbError(updErr ?? 'no row returned');

  return GoCardlessMandate.parse(updated);
}
