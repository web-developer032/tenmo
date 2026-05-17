import 'server-only';
import type { SubscriptionTier, TierLimitedResource } from '@/core/constants/billing';
import { checkResourceAllowed, type LimitCheck } from '@/core/utils/tier-rules';
import { AppError, ErrorCode } from '@/lib/errors';
import { createServiceClient } from '@/lib/supabase/service';
import { getOrgUsage } from './get-usage';

/**
 * Server-side gate used by mutating Route Handlers (property/room
 * create, tenancy invite, …) to enforce tier limits before they hit
 * the database.
 *
 * Reads the org's subscription via the service client (so it never
 * depends on the caller's RLS scope) and combines it with live usage
 * counts to make a single allow/deny decision. Throws an
 * AppError(422, 'tier_required') when blocked — the handler's error
 * envelope carries the upgrade copy + suggested tier so the UI can
 * render an upsell toast.
 */
export async function assertTierAllows(
  orgId: string,
  resource: TierLimitedResource,
): Promise<void> {
  const sb = createServiceClient();
  const [{ data: sub, error: subErr }, usage] = await Promise.all([
    sb.from('org_subscriptions').select('tier, status').eq('org_id', orgId).maybeSingle(),
    getOrgUsage(orgId),
  ]);

  if (subErr) {
    throw new AppError(500, ErrorCode.db_error, 'Subscription lookup failed', {
      cause: String(subErr),
    });
  }

  const decision: LimitCheck = checkResourceAllowed(
    resource,
    sub ? { tier: sub.tier as SubscriptionTier, status: sub.status as never } : null,
    usage,
  );

  if (decision.allowed) return;

  throw new AppError(422, ErrorCode.tier_required, decision.message, {
    resource: decision.resource,
    currentTier: decision.currentTier,
    suggestedTier: decision.suggestedTier,
    currentCount: decision.currentCount,
    limit: decision.limit,
  });
}
