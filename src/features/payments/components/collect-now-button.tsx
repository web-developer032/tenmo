'use client';

import { Banknote, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { collectChargeApi, PaymentsApiError } from '../api/client';

/** Landlord-side "Collect now" button — issues a one-off DD pull
 * against an outstanding charge. Only renderable when the parent
 * already knows there's an active mandate. */
export function CollectNowButton({
  chargeId,
  variant = 'outline',
  size = 'sm',
}: {
  chargeId: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}) {
  const [pending, setPending] = React.useState(false);
  const router = useRouter();

  async function handle() {
    setPending(true);
    try {
      const out = await collectChargeApi({ charge_id: chargeId });
      if (out.status === 'created') {
        toast.success('Direct Debit collection scheduled.');
      } else {
        toast.message('Collection skipped.', { description: out.reason ?? 'No work to do.' });
      }
      router.refresh();
    } catch (err) {
      if (err instanceof PaymentsApiError && err.code === 'tier_required') {
        toast.error(err.message, {
          description: 'Upgrade your plan to enable Direct Debit collection.',
        });
      } else {
        const message = err instanceof Error ? err.message : 'Collection failed.';
        toast.error(message);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Button onClick={handle} disabled={pending} variant={variant} size={size}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Banknote className="mr-2 h-4 w-4" />
      )}
      Collect now
    </Button>
  );
}
