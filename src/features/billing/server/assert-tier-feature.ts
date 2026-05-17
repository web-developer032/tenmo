import 'server-only';
import type { SubscriptionTier, TierFeature } from '@/core/constants/billing';
import { checkFeatureAllowed, type FeatureCheck } from '@/core/utils/tier-rules';
import { AppError, ErrorCode } from '@/lib/errors';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Server-side gate for boolean tier features (e.g. GoCardless DD,
 * AI triage, MTD export). Complements `assertTierAllows`, which gates
 * countable resources.
 *
 * Reads the org's subscription via the service client (so it never
 * depends on the caller's RLS scope) and asks `checkFeatureAllowed`
 * for the decision. Throws `AppError(422, 'tier_required')` when
 * blocked, with structured details the UI can render an upsell from.
 */
export async function assertTierFeature(orgId: string, feature: TierFeature): Promise<void> {
  const sb = createServiceClient();
  const { data: sub, error: subErr } = await sb
    .from('org_subscriptions')
    .select('tier, status')
    .eq('org_id', orgId)
    .maybeSingle();

  if (subErr) {
    throw new AppError(500, ErrorCode.db_error, 'Subscription lookup failed', {
      cause: String(subErr),
    });
  }

  const decision: FeatureCheck = checkFeatureAllowed(
    feature,
    sub ? { tier: sub.tier as SubscriptionTier, status: sub.status as never } : null,
  );

  if (decision.allowed) return;

  throw new AppError(422, ErrorCode.tier_required, decision.message, {
    feature: decision.feature,
    currentTier: decision.currentTier,
    suggestedTier: decision.suggestedTier,
    reason: decision.reason,
  });
}
