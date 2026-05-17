import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { STATUSES_THAT_LOCK_FEATURES, type SubscriptionStatus } from '@/core/constants/billing';
import { cn } from '@/lib/cn';

/**
 * Inline banner shown above landlord pages when the org's subscription
 * isn't healthy. Server-rendered (no client JS) — caller passes the
 * current status + slug.
 */
export function PastDueBanner({
  status,
  orgSlug,
  className,
}: {
  status: SubscriptionStatus | null | undefined;
  orgSlug: string;
  className?: string;
}) {
  if (!status || !STATUSES_THAT_LOCK_FEATURES.includes(status)) return null;

  const label =
    status === 'past_due'
      ? 'Your last payment failed'
      : status === 'canceled'
        ? 'Your subscription is cancelled'
        : status === 'unpaid'
          ? 'Your subscription is unpaid'
          : 'Your subscription is incomplete';

  return (
    <div
      className={cn(
        'flex items-start gap-3 border-b border-destructive/40 bg-destructive/10 px-4 py-3 text-sm',
        className,
      )}
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-destructive">{label}</p>
        <p className="mt-0.5 text-muted-foreground">
          New properties, rooms, and tenancy invites are paused until your subscription is back on
          track. Existing data is unaffected.
        </p>
      </div>
      <Link
        href={`/landlord/${orgSlug}/billing`}
        className="shrink-0 rounded-md border border-destructive px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground"
      >
        Update payment
      </Link>
    </div>
  );
}
