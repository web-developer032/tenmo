'use client';

import { Loader2, MessageSquarePlus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { findOrCreateDirect, MessagingApiError } from '../api/client';
import type { MessageCandidate } from '../server/list-message-candidates';

/**
 * Modal that lets a landlord start (or jump to) a 1-1 direct conversation
 * with another member of their org or a current tenant.
 *
 * Why this exists: previously the only way to start a thread was via the
 * `tenancies` auto-create trigger, which meant ad-hoc DMs (landlord ↔ agent,
 * landlord ↔ pre-tenancy applicant) had no UI entry point at all.
 *
 * Behaviour:
 *   - Renders a button that opens the dialog.
 *   - Lists candidates passed in by the server (see
 *     `listMessageCandidates`). Filtered client-side by name/email.
 *   - On select, calls `POST /api/conversations` and navigates to the
 *     new (or existing) thread. The endpoint is idempotent.
 *
 * Tenants don't see this UI: their messaging happens inside the
 * tenancy conversation that's auto-created on invite acceptance.
 */
export function NewConversationDialog({
  orgId,
  candidates,
  triggerClassName,
}: {
  orgId: string;
  candidates: MessageCandidate[];
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => {
      return (
        (c.full_name ?? '').toLowerCase().includes(q) ||
        (c.contact_email ?? '').toLowerCase().includes(q)
      );
    });
  }, [candidates, query]);

  async function start(candidate: MessageCandidate) {
    setError(null);
    setPendingId(candidate.user_id);
    try {
      const conversationId = await findOrCreateDirect({
        org_id: orgId,
        other_user_id: candidate.user_id,
      });
      setOpen(false);
      router.push(`/messages/${conversationId}`);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof MessagingApiError ? err.message : ((err as Error).message ?? 'Failed');
      setError(message);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className={cn('gap-1.5', triggerClassName)}>
          <MessageSquarePlus className="h-3.5 w-3.5" />
          New message
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a conversation</DialogTitle>
          <DialogDescription>
            Pick a team member or current tenant. Existing threads are reused — clicking someone you
            already messaged jumps straight to it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search by name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
              type="search"
              aria-label="Search candidates"
            />
          </div>

          <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border bg-background p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">
                {candidates.length === 0
                  ? 'No teammates or tenants found in this workspace yet.'
                  : 'No matches.'}
              </li>
            ) : (
              filtered.map((c) => (
                <li key={c.user_id}>
                  <button
                    type="button"
                    onClick={() => start(c)}
                    disabled={pendingId !== null}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50',
                      pendingId === c.user_id && 'bg-accent',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {c.full_name ?? c.contact_email ?? c.user_id}
                      </div>
                      <div className="truncate text-[11.5px] text-muted-foreground">
                        {c.contact_email ?? '—'} · {c.kind === 'member' ? 'Team' : 'Tenant'}
                        {c.detail ? ` · ${c.detail}` : ''}
                      </div>
                    </div>
                    {pendingId === c.user_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>

          {error ? (
            <p className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
