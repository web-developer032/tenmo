'use client';

import { ExternalLink, Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { openPortalApi } from '@/features/billing/api/client';

/** "Manage in Stripe" button — owner-only, hidden when there's no
 * customer id yet (the parent decides whether to render us). */
export function ManageButton({ orgId }: { orgId: string }) {
  const [pending, setPending] = React.useState(false);

  async function handle() {
    setPending(true);
    try {
      const { url } = await openPortalApi({ org_id: orgId });
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not open Stripe portal.';
      toast.error(message);
      setPending(false);
    }
  }

  return (
    <Button onClick={handle} disabled={pending} variant="outline">
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <ExternalLink className="mr-2 h-4 w-4" />
      )}
      Manage in Stripe
    </Button>
  );
}
