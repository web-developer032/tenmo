'use client';

import { Check, Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type BillingInterval,
  SUBSCRIPTION_PLANS,
  type SubscriptionTier,
} from '@/core/constants/billing';
import { compareTier, formatPriceGBP } from '@/core/utils/tier-rules';
import { startCheckoutApi } from '@/features/billing/api/client';
import { cn } from '@/lib/cn';

/**
 * Single plan card. Knows its tier; renders price + highlights and a
 * CTA. The CTA copy + behaviour adapts to the org's current tier:
 *   - same tier  → "Current plan" (disabled)
 *   - upgrade    → "Upgrade to X"  (POST /checkout, redirect)
 *   - downgrade  → "Switch to X"   (Customer Portal handles proration)
 *   - free tier  → "Manage billing" or no CTA on the Free tier card
 */
export function PlanCard({
  tier,
  interval,
  orgId,
  currentTier,
  isOwner,
}: {
  tier: SubscriptionTier;
  interval: BillingInterval;
  orgId: string;
  currentTier: SubscriptionTier;
  isOwner: boolean;
}) {
  const plan = SUBSCRIPTION_PLANS[tier];
  const [pending, setPending] = React.useState(false);
  const cmp = compareTier(tier, currentTier);
  const isCurrent = cmp === 0;
  const isUpgrade = cmp > 0;
  const isFree = tier === 'free';
  const monthly = interval === 'monthly' ? plan.monthly_pence : plan.annual_pence_per_month;

  async function handleCheckout() {
    if (isFree || isCurrent) return;
    setPending(true);
    try {
      const { url } = await startCheckoutApi({
        org_id: orgId,
        tier: tier as Exclude<SubscriptionTier, 'free'>,
        interval,
      });
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start checkout.';
      toast.error(message);
      setPending(false);
    }
  }

  const ctaLabel = isCurrent
    ? 'Current plan'
    : isFree
      ? 'Downgrade in portal'
      : isUpgrade
        ? `Upgrade to ${plan.name}`
        : `Switch to ${plan.name}`;

  const cardTone = isCurrent ? 'border-primary shadow-md' : 'border-border';

  return (
    <Card className={cn('flex flex-col', cardTone)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">{plan.name}</CardTitle>
          {isCurrent && <Badge variant="success">Current</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-3xl font-bold">{formatPriceGBP(monthly)}</span>
          {monthly > 0 && <span className="text-sm text-muted-foreground">/ month</span>}
        </div>
        {monthly > 0 && interval === 'annual' && (
          <p className="mt-1 text-xs text-muted-foreground">
            Billed yearly — saves ~15% vs. monthly
          </p>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-2 text-sm">
          {plan.highlights.map((h) => (
            <li key={h} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        {isFree ? (
          <Button variant="outline" disabled={true} className="w-full">
            {isCurrent ? 'Current plan' : 'Downgrade in portal'}
          </Button>
        ) : (
          <Button
            onClick={handleCheckout}
            disabled={isCurrent || pending || !isOwner}
            variant={isUpgrade ? 'default' : 'outline'}
            className="w-full"
            title={!isOwner ? 'Only the org owner can change billing' : undefined}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {ctaLabel}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
