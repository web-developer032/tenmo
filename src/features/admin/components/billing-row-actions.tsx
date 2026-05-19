'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

type Props = {
  orgId: string;
  stripeCustomerId: string | null;
  canEdit: boolean;
  hasFailure: boolean;
};

/**
 * Row-level actions on /admin/billing: "Retry payment", "Send
 * reminder", "Manage in Stripe". Roles without billing write
 * permission see a single read-only "View" affordance.
 */
export function BillingRowActions({ orgId, stripeCustomerId, canEdit, hasFailure }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const post = (path: string, label: string) => {
    startTransition(async () => {
      try {
        const res = await fetch(path, { method: 'POST' });
        const j = (await res.json().catch(() => null)) as {
          data?: { message?: string };
          error?: { message?: string };
        } | null;
        if (!res.ok) {
          toast.error(j?.error?.message ?? `Could not ${label.toLowerCase()}`);
          return;
        }
        toast.success(j?.data?.message ?? `${label} sent`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Could not ${label.toLowerCase()}`);
      }
    });
  };

  if (!canEdit) {
    return (
      <Button asChild size="sm" variant="ghost">
        <a href={`/admin/orgs/${orgId}`}>View</a>
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasFailure ? (
        <Button
          size="sm"
          onClick={() => post(`/api/admin/billing/${orgId}/retry`, 'Retry')}
          disabled={pending}
        >
          Retry
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => post(`/api/admin/billing/${orgId}/remind`, 'Reminder')}
        disabled={pending}
      >
        Send reminder
      </Button>
      {stripeCustomerId ? (
        <Button asChild size="sm" variant="outline">
          <a
            href={`https://dashboard.stripe.com/customers/${stripeCustomerId}`}
            target="_blank"
            rel="noreferrer"
          >
            Stripe
          </a>
        </Button>
      ) : null}
    </div>
  );
}
