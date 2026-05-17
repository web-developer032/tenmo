import { Badge } from '@/components/ui/badge';
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUS_LABEL,
  type SubscriptionStatus,
  type SubscriptionTier,
} from '@/core/constants/billing';

const tierLabel = (tier: SubscriptionTier) => SUBSCRIPTION_PLANS[tier].name;

/**
 * Subscription tier + status badges shared by the org list / detail
 * pages. Pure: no data fetching, no client interactivity.
 */

export function TierBadge({
  tier,
  override,
}: {
  tier: SubscriptionTier | null;
  /** When set, indicates the value is from the manual override and
   * is rendered with extra emphasis so the support engineer knows
   * the row is being held in place by a human. */
  override?: boolean;
}) {
  if (!tier) {
    return (
      <Badge variant="outline" className="bg-muted/30">
        Unknown
      </Badge>
    );
  }
  if (override) {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        title="Manual subscription override"
      >
        {tierLabel(tier)} · override
      </Badge>
    );
  }
  return <Badge variant={tier === 'free' ? 'outline' : 'default'}>{tierLabel(tier)}</Badge>;
}

export function StatusBadge({ status }: { status: SubscriptionStatus | null }) {
  if (!status) return null;
  const tone =
    status === 'active' || status === 'trialing'
      ? 'success'
      : status === 'past_due' || status === 'unpaid'
        ? 'destructive'
        : status === 'canceled' || status === 'incomplete'
          ? 'warning'
          : 'outline';
  return <Badge variant={tone}>{SUBSCRIPTION_STATUS_LABEL[status]}</Badge>;
}
