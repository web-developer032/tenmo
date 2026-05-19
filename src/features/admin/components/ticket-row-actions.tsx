'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

type Props = {
  ticketId: string;
  isResolved: boolean;
  isAssignedToMe: boolean;
  canEdit: boolean;
};

export function TicketRowActions({ ticketId, isResolved, isAssignedToMe, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!canEdit) {
    return <span className="text-[11.5px] italic text-ink-light">Read-only</span>;
  }

  const post = (path: string, label: string, body?: unknown) => {
    startTransition(async () => {
      try {
        const res = await fetch(path, {
          method: 'POST',
          headers: body ? { 'content-type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          toast.error(j?.error?.message ?? `Could not ${label.toLowerCase()}`);
          return;
        }
        toast.success(`${label} done`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Could not ${label.toLowerCase()}`);
      }
    });
  };

  if (isResolved) {
    return <span className="text-[11.5px] text-ink-light">Resolved</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isAssignedToMe ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => post(`/api/admin/support/${ticketId}/assign-me`, 'Assign')}
          disabled={pending}
        >
          Assign to me
        </Button>
      ) : null}
      <Button
        size="sm"
        onClick={() => post(`/api/admin/support/${ticketId}/resolve`, 'Resolve')}
        disabled={pending}
      >
        Resolve
      </Button>
    </div>
  );
}
