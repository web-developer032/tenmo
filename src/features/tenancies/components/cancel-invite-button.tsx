'use client';

import { Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * "Cancel invite" action — only meaningful when status is `pending_invite`.
 * Wrapped in a confirm() to avoid accidental clicks; the underlying RPC is
 * idempotent enough to refresh server state on success.
 */
export function CancelInviteButton({ tenancyId }: { tenancyId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const onClick = () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Cancel this invite? This cannot be undone.')
    ) {
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/tenancies/${tenancyId}/cancel`, { method: 'POST' });
      const json = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        toast.error(json?.error?.message ?? 'Could not cancel the invite');
        return;
      }
      toast.success('Invite cancelled');
      router.refresh();
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={isPending}>
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <X className="mr-2 h-4 w-4" />
      )}
      Cancel invite
    </Button>
  );
}
