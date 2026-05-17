'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function WithdrawApplicationButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function withdraw() {
    if (busy) return;
    if (
      !confirm('Withdraw this application? You can re-apply later if the room is still available.')
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/tenant/applications/${applicationId}/withdraw`, {
        method: 'POST',
      });
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message ?? 'Could not withdraw');
      toast.success('Application withdrawn');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not withdraw');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={withdraw} disabled={busy}>
      {busy ? 'Withdrawing…' : 'Withdraw'}
    </Button>
  );
}
