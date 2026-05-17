'use client';

import { Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { BillsApiError, deleteBillApi } from '../api/client';

export function DeleteBillButton({ billId }: { billId: string }) {
  const [pending, setPending] = React.useState(false);
  const router = useRouter();

  async function handle() {
    if (!confirm('Delete this bill and all of its allocations?')) return;
    setPending(true);
    try {
      await deleteBillApi(billId);
      toast.success('Bill deleted.');
      router.refresh();
    } catch (err) {
      const msg = err instanceof BillsApiError ? err.message : 'Could not delete bill.';
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button onClick={handle} disabled={pending} variant="ghost" size="sm" aria-label="Delete bill">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}
