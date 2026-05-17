'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
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
import { Textarea } from '@/components/ui/textarea';
import { TICKET_STATUS_LABEL, type TicketStatus } from '@/core/constants/tickets';
import { allowedNextStatuses, type TicketActorRole } from '@/core/utils/ticket-rules';

/**
 * Status transition button + confirmation dialog.
 *
 * Renders the set of allowed transitions for the caller's role. Each one
 * opens a small dialog where the user can add an optional note (sent in the
 * audit message + status-change email).
 */
export function TicketStatusActions({
  ticketId,
  currentStatus,
  actorRole,
}: {
  ticketId: string;
  currentStatus: TicketStatus;
  actorRole: TicketActorRole;
}) {
  const transitions = allowedNextStatuses(currentStatus, actorRole);
  if (transitions.length === 0) {
    return (
      <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        No further actions available from <strong>{TICKET_STATUS_LABEL[currentStatus]}</strong>.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {transitions.map((to) => (
        <TransitionButton key={to} ticketId={ticketId} to={to} actorRole={actorRole} />
      ))}
    </div>
  );
}

function TransitionButton({
  ticketId,
  to,
  actorRole,
}: {
  ticketId: string;
  to: TicketStatus;
  actorRole: TicketActorRole;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const label = TICKET_STATUS_LABEL[to];
  const variant = pickVariant(to);
  const cta = ctaLabel(to, actorRole);

  const submit = async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to, note: note.trim() || null }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: unknown;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.data) {
        toast.error(json?.error?.message ?? `Could not move ticket to ${label}`);
        return;
      }
      toast.success(`Moved to ${label}`);
      setOpen(false);
      setNote('');
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant}>
          {cta}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cta}</DialogTitle>
          <DialogDescription>
            Add an optional note. The other side will see it on the ticket and in the email
            notification.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional context…"
          rows={3}
          maxLength={2000}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending} variant={variant}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function pickVariant(to: TicketStatus): 'default' | 'destructive' | 'outline' {
  if (to === 'cancelled') return 'destructive';
  if (to === 'closed' || to === 'resolved') return 'default';
  return 'outline';
}

function ctaLabel(to: TicketStatus, actorRole: TicketActorRole): string {
  const label = TICKET_STATUS_LABEL[to];
  if (to === 'open' && actorRole === 'tenant') return 'Reopen';
  if (to === 'cancelled') return actorRole === 'tenant' ? 'Cancel ticket' : 'Cancel';
  if (to === 'resolved') return 'Mark resolved';
  if (to === 'closed') return 'Close';
  return `Move to ${label.toLowerCase()}`;
}
