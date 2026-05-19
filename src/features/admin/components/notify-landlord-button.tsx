'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

type Props = {
  orgId: string;
  violationId: string;
  kind: string;
  canEdit: boolean;
};

export function NotifyLandlordButton({ orgId, violationId, kind, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!canEdit) {
    return <span className="text-[11.5px] italic text-ink-light">Read-only</span>;
  }

  const submit = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/compliance/notify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ org_id: orgId, violation_id: violationId, kind }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          toast.error(j?.error?.message ?? 'Could not send alert');
          return;
        }
        toast.success('Landlord notified');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not send alert');
      }
    });
  };

  return (
    <Button size="sm" onClick={submit} disabled={pending}>
      Alert landlord
    </Button>
  );
}
