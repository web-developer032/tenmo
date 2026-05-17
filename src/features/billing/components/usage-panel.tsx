import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  SUBSCRIPTION_PLANS,
  type SubscriptionTier,
  TIER_RESOURCE_LABEL,
  type TierLimitedResource,
} from '@/core/constants/billing';
import type { OrgUsage } from '@/core/schemas/billing';
import { usagePercent } from '@/core/utils/tier-rules';
import { cn } from '@/lib/cn';

const RESOURCES: TierLimitedResource[] = ['properties', 'rooms', 'tenancies', 'org_members'];

/** Shows usage / limit per resource with a progress bar. Pure server
 * component — relies on server-loaded data from `loadBillingFeed`. */
export function UsagePanel({ tier, usage }: { tier: SubscriptionTier; usage: OrgUsage }) {
  const limits = SUBSCRIPTION_PLANS[tier].limits;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
        <p className="text-sm text-muted-foreground">
          Live counts vs. your {SUBSCRIPTION_PLANS[tier].name} plan limits.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {RESOURCES.map((r) => {
            const limit = limits[r];
            const count = usage[r];
            const pct = usagePercent(r, tier, usage);
            const atCap = limit !== null && count >= limit;
            return (
              <li key={r}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="capitalize">{TIER_RESOURCE_LABEL[r]}</span>
                  <span className={cn(atCap && 'font-medium text-destructive')}>
                    {count} {limit === null ? '/ unlimited' : `/ ${limit}`}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full transition-all',
                      atCap ? 'bg-destructive' : pct >= 80 ? 'bg-warning' : 'bg-primary',
                    )}
                    style={{ width: `${limit === null ? 0 : pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
