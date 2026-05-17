import {
  STATUSES_THAT_LOCK_FEATURES,
  SUBSCRIPTION_PLANS,
  type SubscriptionTier,
  TIER_FEATURE_LABEL,
  TIER_FEATURES,
  TIER_ORDER,
  TIER_RESOURCE_LABEL,
  type TierFeature,
  type TierLimitedResource,
  type TierLimits,
} from '../constants/billing';
import type { OrgSubscription, OrgUsage } from '../schemas/billing';

/**
 * Pure tier-enforcement helpers — no React, no Supabase, no Stripe.
 *
 * The same logic is mirrored in the SQL function
 * `public.org_effective_tier(uuid)` so query-side rollups can ask the
 * same question. Keep them in sync if you change the lock-set.
 */

/** Returns the tier we should enforce limits against. Downgrades to
 * `free` when the subscription is past_due / canceled / unpaid /
 * incomplete — this locks new resource creation while keeping
 * existing data accessible. An admin `override_tier` (Phase O)
 * always wins, even over a locked status, so support can rescue
 * stuck orgs. */
export function effectiveTier(
  sub:
    | (Pick<OrgSubscription, 'tier' | 'status'> & {
        override_tier?: SubscriptionTier | null;
      })
    | null,
): SubscriptionTier {
  if (!sub) return 'free';
  if (sub.override_tier) return sub.override_tier;
  if (STATUSES_THAT_LOCK_FEATURES.includes(sub.status)) return 'free';
  return sub.tier;
}

/** Limits applicable for a given tier. Convenience pass-through. */
export function tierLimits(tier: SubscriptionTier): TierLimits {
  return SUBSCRIPTION_PLANS[tier].limits;
}

/** Result shape for limit checks. `allowed=false` carries everything
 * the UI needs to render an upsell toast: which resource hit the cap,
 * the current tier, the suggested next tier, and the cap value. */
export type LimitCheck =
  | { allowed: true }
  | {
      allowed: false;
      reason: 'limit_reached' | 'feature_locked';
      resource: TierLimitedResource;
      currentTier: SubscriptionTier;
      suggestedTier: SubscriptionTier | null;
      currentCount: number;
      limit: number;
      message: string;
    };

/** Check whether the org can add one more of `resource` given its
 * current effective tier + usage counts. */
export function checkResourceAllowed(
  resource: TierLimitedResource,
  sub: Pick<OrgSubscription, 'tier' | 'status'> | null,
  usage: OrgUsage,
): LimitCheck {
  const tier = effectiveTier(sub);
  const limit = SUBSCRIPTION_PLANS[tier].limits[resource];
  if (limit === null) return { allowed: true };

  const currentCount = usage[resource];
  if (currentCount < limit) return { allowed: true };

  const suggestedTier = nextTierThatAllows(resource, currentCount + 1, tier);
  const reason: 'limit_reached' | 'feature_locked' =
    sub && STATUSES_THAT_LOCK_FEATURES.includes(sub.status) && sub.tier !== 'free'
      ? 'feature_locked'
      : 'limit_reached';
  const reasonCopy =
    reason === 'feature_locked'
      ? `Your subscription is ${humaniseStatus(sub?.status)} — adding more ${TIER_RESOURCE_LABEL[resource]} is paused until you update payment.`
      : `Your ${SUBSCRIPTION_PLANS[tier].name} plan is capped at ${limit} ${TIER_RESOURCE_LABEL[resource]}.`;
  const upgradeCopy = suggestedTier
    ? ` Upgrade to ${SUBSCRIPTION_PLANS[suggestedTier].name} to add more.`
    : '';

  return {
    allowed: false,
    reason,
    resource,
    currentTier: tier,
    suggestedTier,
    currentCount,
    limit,
    message: `${reasonCopy}${upgradeCopy}`,
  };
}

/** The lowest tier above `from` whose limit for `resource` accommodates
 * at least `count`. Returns `null` if no tier suffices (shouldn't
 * happen — Portfolio is unlimited). */
export function nextTierThatAllows(
  resource: TierLimitedResource,
  count: number,
  from: SubscriptionTier,
): SubscriptionTier | null {
  const startIdx = TIER_ORDER.indexOf(from) + 1;
  for (let i = startIdx; i < TIER_ORDER.length; i++) {
    const t = TIER_ORDER[i];
    if (!t) continue;
    const limit = SUBSCRIPTION_PLANS[t].limits[resource];
    if (limit === null || count <= limit) return t;
  }
  return null;
}

/** Percentage-of-cap progress bar value. Null limits → 0% (unlimited). */
export function usagePercent(
  resource: TierLimitedResource,
  tier: SubscriptionTier,
  usage: OrgUsage,
): number {
  const limit = SUBSCRIPTION_PLANS[tier].limits[resource];
  if (limit === null) return 0;
  if (limit === 0) return 100;
  return Math.min(100, Math.round((usage[resource] / limit) * 100));
}

/** Format pence as a user-facing GBP string ("£12.00" or "£0"). */
export function formatPriceGBP(pence: number): string {
  if (pence === 0) return '£0';
  if (pence % 100 === 0) return `£${pence / 100}`;
  return `£${(pence / 100).toFixed(2)}`;
}

/** Comparison helper — returns negative if a < b, positive if a > b. */
export function compareTier(a: SubscriptionTier, b: SubscriptionTier): number {
  return TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b);
}

function humaniseStatus(status: string | undefined): string {
  if (!status) return 'inactive';
  return status.replace(/_/g, ' ');
}

// ============================================================================
// Tier features (boolean entitlements — complement to checkResourceAllowed)
// ============================================================================

/** True when the org's effective tier includes a given feature. */
export function hasFeature(
  sub: Pick<OrgSubscription, 'tier' | 'status'> | null,
  feature: TierFeature,
): boolean {
  return TIER_FEATURES[effectiveTier(sub)][feature];
}

export type FeatureCheck =
  | { allowed: true }
  | {
      allowed: false;
      reason: 'feature_not_in_tier' | 'feature_locked';
      feature: TierFeature;
      currentTier: SubscriptionTier;
      suggestedTier: SubscriptionTier | null;
      message: string;
    };

/** Check whether the org can use `feature` given its effective tier.
 *
 * Returns a structured decision so the API handler can throw `422
 * tier_required` with the upgrade copy + suggested tier, and the UI
 * can render an upsell. */
export function checkFeatureAllowed(
  feature: TierFeature,
  sub: Pick<OrgSubscription, 'tier' | 'status'> | null,
): FeatureCheck {
  const tier = effectiveTier(sub);
  if (TIER_FEATURES[tier][feature]) return { allowed: true };

  // Find the cheapest tier that does include the feature.
  const suggestedTier =
    TIER_ORDER.slice(TIER_ORDER.indexOf(tier) + 1).find((t) => TIER_FEATURES[t][feature]) ?? null;

  const reason: 'feature_not_in_tier' | 'feature_locked' =
    sub && STATUSES_THAT_LOCK_FEATURES.includes(sub.status) && sub.tier !== 'free'
      ? 'feature_locked'
      : 'feature_not_in_tier';

  const head =
    reason === 'feature_locked'
      ? `${TIER_FEATURE_LABEL[feature]} is paused while your subscription is ${humaniseStatus(sub?.status)}.`
      : `${TIER_FEATURE_LABEL[feature]} isn't included in your ${SUBSCRIPTION_PLANS[tier].name} plan.`;
  const tail = suggestedTier
    ? ` Upgrade to ${SUBSCRIPTION_PLANS[suggestedTier].name} to unlock it.`
    : '';

  return {
    allowed: false,
    reason,
    feature,
    currentTier: tier,
    suggestedTier,
    message: `${head}${tail}`,
  };
}
