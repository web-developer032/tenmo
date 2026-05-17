'use client';

import { Banknote, Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PaymentsApiError, startMandateApi } from '../api/client';

/**
 * "Set up Direct Debit" button — kicks off a GC Redirect Flow and
 * navigates the browser to GoCardless's hosted form.
 *
 * Surfaces tier-required errors as a toast that links the tenant
 * back to ask their landlord to upgrade (we don't expose the
 * landlord's billing UI to the tenant).
 */
export function SetupDdButton({
  tenancyId,
  variant = 'default',
  size = 'default',
  className,
}: {
  tenancyId: string;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}) {
  const [pending, setPending] = React.useState(false);

  async function handle() {
    setPending(true);
    try {
      const { redirect_url } = await startMandateApi({ tenancy_id: tenancyId });
      window.location.href = redirect_url;
    } catch (err) {
      if (err instanceof PaymentsApiError && err.code === 'tier_required') {
        toast.error(err.message, {
          description:
            "Your landlord's plan doesn't include Direct Debit yet. Ask them to upgrade.",
        });
      } else {
        const message = err instanceof Error ? err.message : 'Could not start Direct Debit setup.';
        toast.error(message);
      }
      setPending(false);
    }
  }

  return (
    <Button onClick={handle} disabled={pending} variant={variant} size={size} className={className}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Banknote className="mr-2 h-4 w-4" />
      )}
      Set up Direct Debit
    </Button>
  );
}
