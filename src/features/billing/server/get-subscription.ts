import 'server-only';
import { OrgSubscription } from '@/core/schemas/billing';
import { DbError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Read the org's subscription row.
 *
 * RLS allows any org member to SELECT — we go through the caller's
 * client to inherit that policy. Service-client is used as a fallback
 * for server-only callers (webhook handler, Inngest jobs) that aren't
 * tied to an authenticated user.
 *
 * Returns null when the org has no row yet (shouldn't happen — the
 * orgs trigger inserts a Free row on create — but we guard so legacy
 * data doesn't crash the billing page).
 */
export async function getOrgSubscription(
  ctx: HandlerContext,
  orgId: string,
): Promise<OrgSubscription | null> {
  requireUser(ctx);
  const { data, error } = await ctx.supabase
    .from('org_subscriptions')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw new DbError(error);
  return data ? OrgSubscription.parse(data) : null;
}

/** Service-client variant for unauthenticated callers (webhook handler). */
export async function getOrgSubscriptionService(orgId: string): Promise<OrgSubscription | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('org_subscriptions')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw new DbError(error);
  return data ? OrgSubscription.parse(data) : null;
}
