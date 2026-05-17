import 'server-only';
import { GoCardlessMandate } from '@/core/schemas/payments';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { cancelMandate as gcCancelMandate } from '@/lib/gocardless/client';
import { type HandlerContext, requireUser } from '@/lib/handler';

/**
 * Cancel an active mandate.
 *
 * Either side can cancel:
 *   - the tenant who owns the mandate, OR
 *   - any landlord-side org member with role owner/agent/staff.
 *
 * Calls GC first; if GC succeeds we mark the row cancelled. The
 * `mandates.cancelled` webhook also flips status, so this is
 * primarily for instant UI feedback.
 */
export async function cancelMandateForTenancy(
  ctx: HandlerContext,
  mandateId: string,
): Promise<GoCardlessMandate> {
  const user = requireUser(ctx);

  const { data: mandate, error: lookupErr } = await ctx.supabase
    .from('gocardless_mandates')
    .select('id, org_id, tenant_user_id, gc_mandate_id, status')
    .eq('id', mandateId)
    .maybeSingle();
  if (lookupErr) throw new DbError(lookupErr);
  if (!mandate) throw new AppError(404, ErrorCode.not_found, 'Mandate not found');

  // Either tenant-self, or org member with the right role.
  const isTenant = mandate.tenant_user_id === user.id;
  let isOrgMember = false;
  if (!isTenant) {
    const { data: membership } = await ctx.supabase
      .from('org_memberships')
      .select('role')
      .eq('org_id', mandate.org_id)
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .maybeSingle();
    isOrgMember = Boolean(
      membership && ['owner', 'agent', 'staff'].includes(membership.role as string),
    );
  }
  if (!isTenant && !isOrgMember) {
    throw new AppError(403, ErrorCode.forbidden, 'Not allowed to cancel this mandate');
  }

  if (mandate.status === 'cancelled') {
    return readMandate(ctx, mandateId);
  }

  if (mandate.gc_mandate_id) {
    try {
      await gcCancelMandate(mandate.gc_mandate_id);
    } catch (err) {
      // GC may already have it cancelled (e.g. tenant cancelled at
      // their bank); treat 4xx-but-already-cancelled as success and
      // let the webhook reconcile.
      if (err instanceof AppError && err.status === 422) {
        // proceed to local update
      } else {
        throw err;
      }
    }
  }

  const { data: updated, error: updErr } = await ctx.supabase
    .from('gocardless_mandates')
    .update({ status: 'cancelled' })
    .eq('id', mandateId)
    .select('*')
    .single();
  if (updErr || !updated) throw new DbError(updErr ?? 'no row returned');
  return GoCardlessMandate.parse(updated);
}

async function readMandate(ctx: HandlerContext, mandateId: string): Promise<GoCardlessMandate> {
  const { data, error } = await ctx.supabase
    .from('gocardless_mandates')
    .select('*')
    .eq('id', mandateId)
    .single();
  if (error || !data) throw new DbError(error ?? 'mandate vanished mid-cancel');
  return GoCardlessMandate.parse(data);
}
