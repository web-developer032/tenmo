'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_TIER_VALUES,
  type SubscriptionTier,
} from '@/core/constants/billing';
import type { SubscriptionOverrideInput } from '@/core/schemas/admin';

/**
 * Client-side form for setting / clearing the manual subscription
 * override on an org. Used by `/admin/orgs/[orgId]`.
 *
 * The submit action calls
 * `POST /api/admin/orgs/[orgId]/subscription-override` and refreshes
 * the page on success so the badge updates and the audit trail shows
 * the new entry.
 */
export function SubscriptionOverrideForm({
  orgId,
  currentOverrideTier,
  currentOverrideReason,
}: {
  orgId: string;
  currentOverrideTier: SubscriptionTier | null;
  currentOverrideReason: string | null;
}) {
  const router = useRouter();
  const [tier, setTier] = React.useState<SubscriptionTier | ''>(currentOverrideTier ?? '');
  const [reason, setReason] = React.useState<string>(currentOverrideReason ?? '');
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const submit = (action: 'set' | 'clear') => {
    setError(null);
    const payload: SubscriptionOverrideInput =
      action === 'clear'
        ? { tier: null, reason: reason.trim() || 'Cleared by admin' }
        : { tier: (tier || 'free') as SubscriptionTier, reason: reason.trim() };

    if (action === 'set' && payload.reason.length < 3) {
      setError('Reason must be at least 3 characters.');
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/admin/orgs/${orgId}/subscription-override`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? `Request failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Subscription override</CardTitle>
        <p className="text-xs text-muted-foreground">
          Sets a tier that takes precedence over Stripe. Use sparingly — every change is logged with
          your name, the reason, and the previous values.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="override-tier">Override tier</Label>
          <select
            id="override-tier"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={tier}
            onChange={(e) => setTier(e.target.value as SubscriptionTier | '')}
            disabled={pending}
          >
            <option value="">— Choose a tier —</option>
            {SUBSCRIPTION_TIER_VALUES.map((t) => (
              <option key={t} value={t}>
                {SUBSCRIPTION_PLANS[t].name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="override-reason">
            Reason <span className="text-xs text-muted-foreground">(required, ≥3 chars)</span>
          </Label>
          <Textarea
            id="override-reason"
            rows={3}
            placeholder="e.g. webhook race left them on free, manually upgrading until next sync"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={pending}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => submit('set')} disabled={pending || !tier}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Apply override
          </Button>
          {currentOverrideTier ? (
            <Button variant="outline" onClick={() => submit('clear')} disabled={pending}>
              Clear override
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
