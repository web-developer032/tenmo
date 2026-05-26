'use client';

import { Trash2, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Compact row affordance for the soft-delete lifecycle.
 *
 *   isDeleted ─ shows "Reinstate" (calls /undelete) and ignores
 *               canDelete because reinstating is also super-only.
 *   !isDeleted + canDelete ─ shows "Delete" (calls /delete with a
 *                            reason prompt).
 *   !isDeleted + !canDelete ─ renders nothing (the button never
 *                             flashes for support / readonly roles).
 */
export function LandlordDeleteButton({
  orgId,
  orgName,
  isDeleted,
  canDelete,
}: {
  orgId: string;
  orgName: string;
  isDeleted: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  if (!isDeleted && !canDelete) return null;

  function run(path: 'delete' | 'undelete', body?: Record<string, unknown>) {
    setSubmitting(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/orgs/${orgId}/${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        const json = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        if (!res.ok) {
          throw new Error(json?.error?.message ?? `Could not ${path}`);
        }
        toast.success(path === 'delete' ? `${orgName} deleted` : `${orgName} restored`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Could not ${path}`);
      } finally {
        setSubmitting(false);
      }
    });
  }

  if (isDeleted) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => run('undelete')}
        disabled={pending || submitting}
      >
        <Undo2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        {submitting ? '…' : 'Reinstate'}
      </Button>
    );
  }

  function onDelete() {
    const reason = window.prompt(
      `Delete ${orgName}? This is reversible (the row is soft-deleted). Please record a reason for the audit trail:`,
      'Account closure requested',
    );
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) toast.error('Reason must be at least 3 characters');
      return;
    }
    run('delete', { reason: reason.trim() });
  }

  return (
    <Button size="sm" variant="destructive" onClick={onDelete} disabled={pending || submitting}>
      <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
      {submitting ? '…' : 'Delete'}
    </Button>
  );
}
