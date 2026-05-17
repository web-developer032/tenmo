'use client';

import { Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AstApiError, cancelEnvelopeApi } from '../api/client';

/** Landlord-side "Cancel AST" button. Confirms before calling. */
export function CancelAstButton({
  envelopeId,
  className,
}: {
  envelopeId: string;
  className?: string;
}) {
  const [pending, setPending] = React.useState(false);
  const router = useRouter();

  async function handle() {
    if (!confirm('Cancel this AST signing run? You can send a fresh copy afterwards.')) return;
    setPending(true);
    try {
      await cancelEnvelopeApi(envelopeId);
      toast.success('AST cancelled.');
      router.refresh();
    } catch (err) {
      if (err instanceof AstApiError && err.status === 422) {
        toast.error('This envelope can no longer be cancelled.');
      } else {
        const message = err instanceof Error ? err.message : 'Could not cancel AST.';
        toast.error(message);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Button onClick={handle} disabled={pending} variant="outline" size="sm" className={className}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
      Cancel
    </Button>
  );
}
