'use client';

import { Loader2, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Calls `/api/orgs/[orgId]/compliance/seed` to create blank rows for every
 * legally-required certificate type for the given property. Idempotent.
 */
export function SeedRequiredButton({
  orgId,
  propertyId,
  size = 'default',
}: {
  orgId: string;
  propertyId: string;
  size?: 'sm' | 'default' | 'lg';
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const handle = () => {
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/compliance/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: unknown[];
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        toast.error(json?.error?.message ?? 'Could not seed required certificates');
        return;
      }
      toast.success('Required certificates set up — fill in dates as you have them');
      router.refresh();
    });
  };

  return (
    <Button onClick={handle} disabled={isPending} size={size} variant="outline">
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Wand2 className="mr-2 h-4 w-4" />
      )}
      Set up required certificates
    </Button>
  );
}
