'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Compact row action — toggles between suspend / reinstate. We call
 * `/api/admin/orgs/[id]/suspend` with `{ action }` and refresh the
 * route to repopulate the list with fresh status badges.
 */
export function LandlordSuspendButton({
  orgId,
  isSuspended,
}: {
  orgId: string;
  isSuspended: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const click = () => {
    const action = isSuspended ? 'reinstate' : 'suspend';
    if (
      action === 'suspend' &&
      !confirm('Suspend this landlord? They will lose paid features until reinstated.')
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/orgs/${orgId}/suspend`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          toast.error(j?.error?.message ?? `Could not ${action}`);
          return;
        }
        toast.success(action === 'suspend' ? 'Landlord suspended' : 'Landlord reinstated');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Could not ${action}`);
      }
    });
  };

  return (
    <Button
      size="sm"
      variant={isSuspended ? 'outline' : 'destructive'}
      onClick={click}
      disabled={pending}
    >
      {pending ? '…' : isSuspended ? 'Reinstate' : 'Suspend'}
    </Button>
  );
}
