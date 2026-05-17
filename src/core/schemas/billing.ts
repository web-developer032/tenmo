import { z } from 'zod';
import {
  BILLING_INTERVAL_VALUES,
  type BillingInterval,
  SUBSCRIPTION_STATUS_VALUES,
  SUBSCRIPTION_TIER_VALUES,
  type SubscriptionStatus,
  type SubscriptionTier,
} from '../constants/billing';
import { uuid } from './common';

/**
 * Billing schemas.
 *
 * Mirror `public.org_subscriptions` and the input bodies for the
 * billing API routes.
 */

export const SubscriptionTierEnum = z.enum(
  SUBSCRIPTION_TIER_VALUES as [SubscriptionTier, ...SubscriptionTier[]],
);

export const SubscriptionStatusEnum = z.enum(
  SUBSCRIPTION_STATUS_VALUES as [SubscriptionStatus, ...SubscriptionStatus[]],
);

export const BillingIntervalEnum = z.enum(
  BILLING_INTERVAL_VALUES as [BillingInterval, ...BillingInterval[]],
);

export const OrgSubscription = z.object({
  org_id: uuid,
  tier: SubscriptionTierEnum,
  status: SubscriptionStatusEnum,
  stripe_customer_id: z.string().nullable(),
  stripe_subscription_id: z.string().nullable(),
  stripe_price_id: z.string().nullable(),
  current_period_end: z.string().nullable(),
  cancel_at_period_end: z.boolean(),
  canceled_at: z.string().nullable(),
  trial_end: z.string().nullable(),
  last_synced_at: z.string().nullable(),
  // Phase O — manual admin override. When set, takes precedence
  // over `tier` for entitlement checks (see effectiveTier()).
  override_tier: SubscriptionTierEnum.nullable(),
  override_reason: z.string().nullable(),
  override_set_by: uuid.nullable(),
  override_set_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type OrgSubscription = z.infer<typeof OrgSubscription>;

/** Live counts of resources the tier limits gate. Computed by
 * `features/billing/server/get-usage.ts`. */
export const OrgUsage = z.object({
  properties: z.number().int().nonnegative(),
  rooms: z.number().int().nonnegative(),
  tenancies: z.number().int().nonnegative(),
  org_members: z.number().int().nonnegative(),
});

export type OrgUsage = z.infer<typeof OrgUsage>;

/** Body for `POST /api/billing/checkout`. */
export const CreateCheckoutInput = z.object({
  org_id: uuid,
  tier: SubscriptionTierEnum.refine((t) => t !== 'free', {
    message: 'Cannot checkout the free tier',
  }),
  interval: BillingIntervalEnum.default('monthly'),
});

export type CreateCheckoutInput = z.infer<typeof CreateCheckoutInput>;

/** Body for `POST /api/billing/portal`. */
export const CreatePortalInput = z.object({
  org_id: uuid,
});

export type CreatePortalInput = z.infer<typeof CreatePortalInput>;
