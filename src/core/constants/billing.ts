/**
 * Billing domain — tier definitions, limits, status mapping.
 *
 * Source of truth for the database `subscription_tier` /
 * `subscription_status` enums (see migration
 * `20260101001700_org_subscriptions.sql`) and for tier-limit
 * enforcement throughout the app.
 *
 * Pricing copy (£/mo, annual discount) lives here so the marketing
 * page, the /billing page, and the future paywall toasts can all
 * read from one place. Real Stripe Price IDs are wired via env vars
 * (see `lib/env.server.ts`) and resolved server-side only.
 */

export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'portfolio';

export const SUBSCRIPTION_TIER_VALUES: SubscriptionTier[] = ['free', 'starter', 'pro', 'portfolio'];

export type SubscriptionStatus =
  | 'free'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete';

export const SUBSCRIPTION_STATUS_VALUES: SubscriptionStatus[] = [
  'free',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
];

/** Resource counts that we cap per tier. */
export type TierLimitedResource = 'properties' | 'rooms' | 'tenancies' | 'org_members';

/** A limit of `null` means unlimited (Portfolio tier). */
export type TierLimits = Record<TierLimitedResource, number | null>;

/** Plan metadata that the UI + server enforcement read from. */
export type TierPlan = {
  tier: SubscriptionTier;
  /** Display name on the billing page + paywall toasts. */
  name: string;
  /** One-line summary for the plan-compare card. */
  tagline: string;
  /** Monthly price in pence. `0` for free. */
  monthly_pence: number;
  /** Annual price (~15% discount) in pence per month. `0` for free. */
  annual_pence_per_month: number;
  /** Hard caps. `null` = unlimited. */
  limits: TierLimits;
  /** Bullet points for the plan-compare card. */
  highlights: string[];
};

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, TierPlan> = {
  free: {
    tier: 'free',
    name: 'Free',
    tagline: 'For accidental landlords with one room.',
    monthly_pence: 0,
    annual_pence_per_month: 0,
    limits: { properties: 1, rooms: 1, tenancies: 1, org_members: 1 },
    highlights: [
      '1 property, 1 room, 1 tenancy',
      'Compliance Engine + reminders',
      'Manual rent ledger',
      'Maintenance tickets',
      'In-app messaging',
      'Free forever for tenants',
    ],
  },
  starter: {
    tier: 'starter',
    name: 'Starter',
    tagline: 'For private landlords scaling beyond a single room.',
    // Pricing is currently a `[NUMBER NEEDED]` placeholder in
    // docs/01-business/pricing-and-subscriptions.md — we use £12/mo
    // here so the UI renders sensibly. Real Price IDs come from env
    // (STRIPE_PRICE_STARTER_MONTHLY / STRIPE_PRICE_STARTER_ANNUAL).
    monthly_pence: 1200,
    annual_pence_per_month: 1020,
    limits: { properties: 5, rooms: 25, tenancies: 25, org_members: 2 },
    highlights: [
      '5 properties, up to 25 rooms',
      'GoCardless rent collection (Phase K)',
      '2 GB document vault',
      'Email support (48h SLA)',
      'Everything in Free',
    ],
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    tagline: 'For landlords with portfolios that need automation.',
    monthly_pence: 2900,
    annual_pence_per_month: 2465,
    limits: { properties: 25, rooms: 150, tenancies: 150, org_members: 5 },
    highlights: [
      '25 properties, up to 150 rooms',
      'AI maintenance triage (Phase 2)',
      'AI Section 8 / RRB notice drafts (Phase 2)',
      '20 GB document vault',
      'HMRC MTD export (Phase 2)',
      'Email support (24h SLA)',
    ],
  },
  portfolio: {
    tier: 'portfolio',
    name: 'Portfolio',
    tagline: 'For agencies and large portfolios.',
    monthly_pence: 5900,
    annual_pence_per_month: 5015,
    limits: { properties: null, rooms: null, tenancies: null, org_members: null },
    highlights: [
      'Unlimited properties / rooms / tenancies',
      'Letting-agent sub-accounts (Phase 2)',
      'White-label (Phase 2)',
      '100 GB document vault',
      'Priority phone / Slack support',
    ],
  },
};

/** Order used when comparing tiers (low → high). */
export const TIER_ORDER: SubscriptionTier[] = ['free', 'starter', 'pro', 'portfolio'];

/** Statuses that downgrade the org's *enforced* tier to `free`. */
export const STATUSES_THAT_LOCK_FEATURES: SubscriptionStatus[] = [
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
];

/** Human label for the status pill on the billing page. */
export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  free: 'Free',
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Payment failed',
  canceled: 'Cancelled',
  unpaid: 'Unpaid',
  incomplete: 'Awaiting payment',
};

export const SUBSCRIPTION_STATUS_TONE: Record<
  SubscriptionStatus,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  free: 'default',
  trialing: 'default',
  active: 'success',
  past_due: 'destructive',
  canceled: 'destructive',
  unpaid: 'destructive',
  incomplete: 'warning',
};

/** Human label for each limited resource (used in paywall toasts). */
export const TIER_RESOURCE_LABEL: Record<TierLimitedResource, string> = {
  properties: 'properties',
  rooms: 'rooms',
  tenancies: 'tenancies',
  org_members: 'team members',
};

/** Stripe-tier-to-billing-interval helper. The webhook handler doesn't
 * need this (Stripe sends the price id and we look it up); it's used
 * by the checkout-session creator to pick the right Price. */
export type BillingInterval = 'monthly' | 'annual';

export const BILLING_INTERVAL_VALUES: BillingInterval[] = ['monthly', 'annual'];

// ============================================================================
// Tier features (boolean entitlements, complement to the count limits above)
// ============================================================================

/**
 * Boolean entitlements gated by tier — for capabilities that don't
 * map to a count (e.g. "can the org collect rent via DD?"). Used by
 * `assertTierFeature(orgId, feature)` server-side.
 *
 * Pricing matrix is the source of truth; see
 * docs/01-business/pricing-and-subscriptions.md.
 */
export type TierFeature =
  | 'rent_collection_dd'
  | 'open_banking_payments'
  | 'ai_maintenance_triage'
  | 'ai_notice_drafting'
  | 'mtd_export'
  | 'marketplace_push'
  | 'sub_account_management'
  | 'white_label';

export const TIER_FEATURE_VALUES: TierFeature[] = [
  'rent_collection_dd',
  'open_banking_payments',
  'ai_maintenance_triage',
  'ai_notice_drafting',
  'mtd_export',
  'marketplace_push',
  'sub_account_management',
  'white_label',
];

/**
 * Per-tier feature matrix. `true` = entitled. Read top-down — Free is
 * the most restrictive, Portfolio the loosest.
 *
 * MUST stay aligned with docs/01-business/pricing-and-subscriptions.md.
 * Any change here is a pricing decision that needs doc-side update too.
 */
export const TIER_FEATURES: Record<SubscriptionTier, Record<TierFeature, boolean>> = {
  free: {
    rent_collection_dd: false,
    open_banking_payments: false,
    ai_maintenance_triage: false,
    ai_notice_drafting: false,
    mtd_export: false,
    marketplace_push: false,
    sub_account_management: false,
    white_label: false,
  },
  starter: {
    rent_collection_dd: true,
    open_banking_payments: true,
    ai_maintenance_triage: false,
    ai_notice_drafting: false,
    mtd_export: true,
    marketplace_push: false,
    sub_account_management: false,
    white_label: false,
  },
  pro: {
    rent_collection_dd: true,
    open_banking_payments: true,
    ai_maintenance_triage: true,
    ai_notice_drafting: true,
    mtd_export: true,
    marketplace_push: true,
    sub_account_management: false,
    white_label: false,
  },
  portfolio: {
    rent_collection_dd: true,
    open_banking_payments: true,
    ai_maintenance_triage: true,
    ai_notice_drafting: true,
    mtd_export: true,
    marketplace_push: true,
    sub_account_management: true,
    white_label: true,
  },
};

/** Human label for the upsell toast. */
export const TIER_FEATURE_LABEL: Record<TierFeature, string> = {
  rent_collection_dd: 'GoCardless Direct Debit rent collection',
  open_banking_payments: 'Open Banking payments',
  ai_maintenance_triage: 'AI maintenance triage',
  ai_notice_drafting: 'AI Section 8 / RRB notice drafts',
  mtd_export: 'HMRC MTD export',
  marketplace_push: 'Marketplace listing push',
  sub_account_management: 'Letting-agent sub-accounts',
  white_label: 'White-label branding',
};
