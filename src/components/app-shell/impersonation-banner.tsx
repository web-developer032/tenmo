'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

/**
 * Yellow sticky strip that sits above the topbar whenever an admin
 * is actively impersonating another user. Tapping "Stop impersonating"
 * POSTs to /api/admin/impersonate/stop, which restores the admin's
 * original session cookies and redirects to /admin.
 *
 * Server-rendered by `AppShell` only when `readImpersonationContext()`
 * returns a non-null target.
 */
export function ImpersonationBanner({
  targetName,
  targetEmail,
}: {
  targetName: string;
  targetEmail: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  function handleStop() {
    if (submitting) return;
    setSubmitting(true);
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/impersonate/stop', { method: 'POST' });
        const json = (await res.json()) as {
          data?: { redirectTo?: string };
          error?: { message?: string };
        };
        if (!res.ok) {
          throw new Error(json.error?.message ?? 'Unable to stop impersonating');
        }
        toast.success(`Stopped impersonating ${targetName}`);
        router.replace(json.data?.redirectTo ?? '/admin');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Unable to stop impersonating');
      } finally {
        setSubmitting(false);
      }
    });
  }

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 border-b border-amber/30 bg-amber-100/70 px-4 py-2 text-[13px] text-amber-900 lg:px-7"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[11px] font-bold text-amber-900">
          !
        </span>
        <span className="truncate">
          You are impersonating <strong>{targetName}</strong>{' '}
          <span className="text-amber-700/80">({targetEmail})</span>
        </span>
      </span>
      <button
        type="button"
        onClick={handleStop}
        disabled={pending || submitting}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-300/60 bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-900 transition hover:bg-amber-50 disabled:opacity-60"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        {submitting ? 'Stopping…' : 'Stop impersonating'}
      </button>
    </div>
  );
}
