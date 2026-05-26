'use client';

import { UserCog } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Row-level "Impersonate" trigger. Calls
 * `/api/admin/impersonate/start` with the org owner's user id; on
 * success the admin's Supabase session is swapped for the target
 * user's session server-side and we redirect home so the rest of
 * the app reflects the new identity.
 *
 * Disabled when:
 *   - the caller isn't a super admin (`disabled` passed by the page)
 *   - the row has no owner_user_id (org pre-dates the membership
 *     model — vanishingly rare in practice, but defensive)
 */
export function ImpersonateButton({
  targetUserId,
  targetLabel,
  disabled,
  disabledReason,
}: {
  targetUserId: string | null;
  targetLabel: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  const isDisabled = disabled || !targetUserId || submitting || pending;

  function handleClick() {
    if (isDisabled || !targetUserId) return;
    if (
      !confirm(
        `Impersonate ${targetLabel}? Every action you take from here will be attributed to the target user. Their landlord/tenant context replaces yours until you click "Stop impersonating".`,
      )
    ) {
      return;
    }
    setSubmitting(true);
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/impersonate/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ targetUserId, reason: 'support investigation' }),
        });
        const json = (await res.json()) as {
          data?: { redirectTo?: string };
          error?: { message?: string };
        };
        if (!res.ok) {
          throw new Error(json.error?.message ?? 'Unable to start impersonation');
        }
        toast.success(`Impersonating ${targetLabel}`);
        router.replace(json.data?.redirectTo ?? '/');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Unable to start impersonation');
      } finally {
        setSubmitting(false);
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={isDisabled}
      title={disabled && disabledReason ? disabledReason : undefined}
    >
      <UserCog className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
      {submitting ? '…' : 'Impersonate'}
    </Button>
  );
}
