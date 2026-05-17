'use client';

import { FileSignature, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AstApiError, startEnvelopeApi } from '../api/client';

/**
 * Landlord-side "Send AST for signing" button.
 *
 * Posts to `/api/ast/envelopes`. On success we toast + refresh the
 * RSC tree so the new envelope row shows up immediately. The DocuSeal
 * 503 ("not configured") path renders a friendly toast instead of
 * surfacing the raw status code.
 */
export function SendAstButton({
  tenancyId,
  variant = 'default',
  size = 'default',
  className,
  label = 'Send AST for signing',
}: {
  tenancyId: string;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  label?: string;
}) {
  const [pending, setPending] = React.useState(false);
  const router = useRouter();

  async function handle() {
    setPending(true);
    try {
      await startEnvelopeApi({ tenancy_id: tenancyId });
      toast.success('AST sent — both parties will receive a signing link by email.');
      router.refresh();
    } catch (err) {
      if (err instanceof AstApiError && err.status === 503) {
        toast.error('DocuSeal is not configured for this environment yet.');
      } else if (err instanceof AstApiError && err.status === 409) {
        toast.error('An AST is already in flight for this tenancy. Cancel it first.');
      } else {
        const message = err instanceof Error ? err.message : 'Could not send AST.';
        toast.error(message);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Button onClick={handle} disabled={pending} variant={variant} size={size} className={className}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileSignature className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
