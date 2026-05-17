'use client';

import { Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cancelMandateApi, PaymentsApiError } from '../api/client';

/** "Cancel Direct Debit" button — confirms first, then nukes the
 * mandate via the API. Refreshes the parent server component on
 * success so the status card flips back to "Set up DD". */
export function CancelDdButton({ mandateId }: { mandateId: string }) {
  const [pending, setPending] = React.useState(false);
  const router = useRouter();

  async function handle() {
    if (
      !window.confirm(
        'Cancel your Direct Debit? Future rent will need to be paid manually until you set up a new one.',
      )
    ) {
      return;
    }
    setPending(true);
    try {
      await cancelMandateApi({ mandate_id: mandateId });
      toast.success('Direct Debit cancelled.');
      router.refresh();
    } catch (err) {
      const message =
        err instanceof PaymentsApiError || err instanceof Error
          ? err.message
          : 'Could not cancel Direct Debit.';
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button onClick={handle} disabled={pending} variant="ghost" size="sm">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
      Cancel Direct Debit
    </Button>
  );
}
