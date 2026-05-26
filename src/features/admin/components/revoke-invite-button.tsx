'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Revokes a pending admin invite via
 * `DELETE /api/admin/team/invites/[inviteId]`. Wired to the "Revoke"
 * affordance on /admin/users (Pending invites section). Super-admin
 * only — the parent page passes `disabled` accordingly.
 */
export function RevokeInviteButton({
  inviteId,
  inviteEmail,
  disabled,
}: {
  inviteId: string;
  inviteEmail: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  function handleClick() {
    if (disabled || submitting || pending) return;
    if (!confirm(`Revoke the invite for ${inviteEmail}? They will lose access immediately.`)) {
      return;
    }
    setSubmitting(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/team/invites/${inviteId}`, { method: 'DELETE' });
        const json = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        if (!res.ok) throw new Error(json?.error?.message ?? 'Unable to revoke invite');
        toast.success(`Invite for ${inviteEmail} revoked`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Unable to revoke invite');
      } finally {
        setSubmitting(false);
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleClick}
      disabled={disabled || pending || submitting}
    >
      <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
      {submitting ? '…' : 'Revoke'}
    </Button>
  );
}
