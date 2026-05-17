'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Authenticated tenant clicks "Accept invite" — calls the API, then routes
 * them to the tenant dashboard. The API enforces email match server-side.
 */
export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const onClick = () => {
    startTransition(async () => {
      const res = await fetch(`/api/invites/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
      });
      const json = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        toast.error(json?.error?.message ?? 'Could not accept the invite');
        return;
      }
      toast.success('Invite accepted — welcome to your new home');
      router.push('/tenant');
      router.refresh();
    });
  };

  return (
    <Button size="lg" onClick={onClick} disabled={isPending} className="w-full">
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle2 className="mr-2 h-4 w-4" />
      )}
      Accept tenancy invite
    </Button>
  );
}
