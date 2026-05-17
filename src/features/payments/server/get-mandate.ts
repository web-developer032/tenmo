import 'server-only';
import { GoCardlessMandate } from '@/core/schemas/payments';
import { DbError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Read the most-relevant mandate for a tenancy.
 *
 * Wraps the `active_mandate_for_tenancy(uuid)` RPC which returns the
 * single active|submitted|pending_submission row (or none). RLS scopes
 * automatically — landlords see all their org's mandates; tenants see
 * only their own.
 */
export async function getActiveMandateForTenancy(
  ctx: HandlerContext,
  tenancyId: string,
): Promise<GoCardlessMandate | null> {
  requireUser(ctx);
  const { data, error } = await ctx.supabase.rpc('active_mandate_for_tenancy', {
    p_tenancy_id: tenancyId,
  });
  if (error) throw new DbError(error);
  const row = Array.isArray(data) ? data[0] : null;
  return row ? GoCardlessMandate.parse(row) : null;
}

/** Service-client variant for unauthenticated callers (cron + webhook
 * handler). Returns the full row including stale statuses if no active
 * mandate exists. */
export async function getMandateByTenancyService(
  tenancyId: string,
): Promise<GoCardlessMandate | null> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('active_mandate_for_tenancy', {
    p_tenancy_id: tenancyId,
  });
  if (error) throw new DbError(error);
  const row = Array.isArray(data) ? data[0] : null;
  return row ? GoCardlessMandate.parse(row) : null;
}

/** Look up a mandate by its GoCardless id (used by the webhook
 * handler when payments arrive referencing a mandate). */
export async function getMandateByGcMandateIdService(
  gcMandateId: string,
): Promise<GoCardlessMandate | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('gocardless_mandates')
    .select('*')
    .eq('gc_mandate_id', gcMandateId)
    .maybeSingle();
  if (error) throw new DbError(error);
  return data ? GoCardlessMandate.parse(data) : null;
}
