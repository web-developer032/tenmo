/**
 * Subscription tiers — landlord-only. Tenants are free forever (ADR-0006).
 *
 * Capability matrix is the single source of truth for tier-gating in
 * BOTH the UI (upsell prompts) and the server (enforcement).
 */

export type Tier = 'free' | 'starter' | 'pro' | 'portfolio';

export type Capability =
  | 'maxProperties'
  | 'maxRooms'
  | 'rentCollection'
  | 'openBanking'
  | 'aiTriage'
  | 'aiSummariser'
  | 'mtdExport'
  | 'multiUser'
  | 'customBranding'
  | 'apiAccess';

/** Capability value: number means a quantitative limit, boolean means feature on/off. */
export type CapabilityValue = number | boolean;

export type TierMatrix = Record<Tier, Record<Capability, CapabilityValue>>;

export const TIER_MATRIX: TierMatrix = {
  free: {
    maxProperties: 1,
    maxRooms: 1,
    rentCollection: false,
    openBanking: false,
    aiTriage: false,
    aiSummariser: false,
    mtdExport: false,
    multiUser: false,
    customBranding: false,
    apiAccess: false,
  },
  starter: {
    maxProperties: 3,
    maxRooms: 12,
    rentCollection: true,
    openBanking: false,
    aiTriage: false,
    aiSummariser: false,
    mtdExport: false,
    multiUser: false,
    customBranding: false,
    apiAccess: false,
  },
  pro: {
    maxProperties: 10,
    maxRooms: 60,
    rentCollection: true,
    openBanking: true,
    aiTriage: true,
    aiSummariser: true,
    mtdExport: true,
    multiUser: true,
    customBranding: false,
    apiAccess: false,
  },
  portfolio: {
    maxProperties: Number.POSITIVE_INFINITY,
    maxRooms: Number.POSITIVE_INFINITY,
    rentCollection: true,
    openBanking: true,
    aiTriage: true,
    aiSummariser: true,
    mtdExport: true,
    multiUser: true,
    customBranding: true,
    apiAccess: true,
  },
};

export const TIER_LABELS: Record<Tier, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  portfolio: 'Portfolio',
};

/**
 * Returns the capability value for a tier — defensive if a future tier is
 * added without updating the matrix.
 */
export function tierCapability(tier: Tier, capability: Capability): CapabilityValue {
  return TIER_MATRIX[tier][capability];
}

/** Check a boolean feature. */
export function tierHasFeature(tier: Tier, capability: Capability): boolean {
  const v = tierCapability(tier, capability);
  return typeof v === 'boolean' ? v : v > 0;
}

/** Check a quantitative limit. */
export function tierWithinLimit(tier: Tier, capability: Capability, current: number): boolean {
  const limit = tierCapability(tier, capability);
  if (typeof limit === 'boolean') return limit;
  return current < limit;
}
