'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type BillingInterval,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
  type SubscriptionTier,
  TIER_ORDER,
} from '@/core/constants/billing';
import type { OrgSubscription, OrgUsage } from '@/core/schemas/billing';
import { effectiveTier } from '@/core/utils/tier-rules';
import { ManageButton } from './manage-button';
import { PlanCard } from './plan-card';
import { UsagePanel } from './usage-panel';

/**
 * Composed billing view — header + status pill, usage panel, plan
 * compare grid with monthly/annual toggle. Pure client because the
 * monthly/annual toggle drives `PlanCard` to re-mint Checkout sessions
 * with the right Price ID.
 */
export function BillingView({
  orgId,
  subscription,
  usage,
  isOwner,
  flashStatus,
}: {
  orgId: string;
  subscription: OrgSubscription | null;
  usage: OrgUsage;
  isOwner: boolean;
  /** Optional flash from the Checkout success/cancel redirect. */
  flashStatus: 'success' | 'cancelled' | null;
}) {
  const [interval, setInterval] = React.useState<BillingInterval>('monthly');
  const currentTier: SubscriptionTier = subscription?.tier ?? 'free';
  const enforcedTier = effectiveTier(subscription);
  const status = subscription?.status ?? 'free';
  const hasStripeCustomer = Boolean(subscription?.stripe_customer_id);
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null;
  const cancelScheduled = subscription?.cancel_at_period_end ?? false;

  const tone = SUBSCRIPTION_STATUS_TONE[status];
  const badgeVariant: 'default' | 'success' | 'destructive' | 'secondary' =
    tone === 'success' ? 'success' : tone === 'destructive' ? 'destructive' : 'secondary';

  return (
    <div className="space-y-8">
      {flashStatus === 'success' && (
        <Card className="border-success/40 bg-success/10">
          <CardContent className="py-4 text-sm text-success-foreground">
            Welcome to {SUBSCRIPTION_PLANS[currentTier].name}. Stripe will email your receipt; the
            new limits are live now.
          </CardContent>
        </Card>
      )}
      {flashStatus === 'cancelled' && (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="py-4 text-sm">
            No charge was made — you cancelled checkout. Your previous plan is unchanged.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">
                {SUBSCRIPTION_PLANS[currentTier].name} plan
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {SUBSCRIPTION_PLANS[currentTier].tagline}
              </p>
            </div>
            <Badge variant={badgeVariant}>{SUBSCRIPTION_STATUS_LABEL[status]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {enforcedTier !== currentTier && (
            <p className="text-destructive">
              Limits are temporarily enforced at the Free tier while your subscription is{' '}
              {SUBSCRIPTION_STATUS_LABEL[status].toLowerCase()}.
            </p>
          )}
          {periodEnd && (
            <p className="text-muted-foreground">
              {cancelScheduled
                ? `Cancels on ${periodEnd.toLocaleDateString()}. You'll keep ${SUBSCRIPTION_PLANS[currentTier].name} access until then.`
                : `Renews on ${periodEnd.toLocaleDateString()}.`}
            </p>
          )}
          {hasStripeCustomer && isOwner && (
            <div className="pt-2">
              <ManageButton orgId={orgId} />
            </div>
          )}
        </CardContent>
      </Card>

      <UsagePanel tier={enforcedTier} usage={usage} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Compare plans</h2>
            <p className="text-sm text-muted-foreground">
              Tenants always pay £0. Change tiers any time — Stripe handles proration.
            </p>
          </div>
          <Tabs
            value={interval}
            onValueChange={(v) => setInterval(v as BillingInterval)}
            className="self-start"
          >
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="annual">Annual (~15% off)</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TIER_ORDER.map((tier) => (
            <PlanCard
              key={tier}
              tier={tier}
              interval={interval}
              orgId={orgId}
              currentTier={currentTier}
              isOwner={isOwner}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
