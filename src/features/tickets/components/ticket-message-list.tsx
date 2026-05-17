'use client';

import { Paperclip, Settings2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { TICKET_STATUS_LABEL } from '@/core/constants/tickets';
import type { TicketMessage } from '@/core/schemas/ticket';
import { cn } from '@/lib/cn';

export type AuthorMap = Record<string, { full_name: string | null; contact_email: string | null }>;

/**
 * Chronological timeline. `currentUserId` is used to lay out comments
 * (yours = right-aligned). System events are centred and italicised.
 */
export function TicketMessageList({
  messages,
  authors,
  currentUserId,
}: {
  messages: TicketMessage[];
  authors: AuthorMap;
  currentUserId: string | null;
}) {
  if (messages.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No messages yet — start the conversation below.
      </div>
    );
  }

  return (
    <ol className="space-y-3" aria-label="Ticket activity">
      {messages.map((m) => {
        if (m.kind !== 'comment') {
          return <SystemEntry key={m.id} message={m} authors={authors} />;
        }
        const isMine = currentUserId !== null && m.author_user_id === currentUserId;
        return (
          <CommentEntry
            key={m.id}
            message={m}
            authors={authors}
            align={isMine ? 'right' : 'left'}
          />
        );
      })}
    </ol>
  );
}

function CommentEntry({
  message,
  authors,
  align,
}: {
  message: TicketMessage;
  authors: AuthorMap;
  align: 'left' | 'right';
}) {
  const author = message.author_user_id ? authors[message.author_user_id] : null;
  const name = author?.full_name ?? author?.contact_email ?? 'Someone';
  const time = formatTime(message.created_at);

  return (
    <li className={cn('flex', align === 'right' ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] space-y-1 rounded-lg border px-3 py-2 text-sm',
          align === 'right' ? 'bg-primary text-primary-foreground' : 'bg-card',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide',
            align === 'right' ? 'text-primary-foreground/80' : 'text-muted-foreground',
          )}
        >
          <span>{name}</span>
          <span aria-hidden>·</span>
          <span>{time}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-snug">{message.body}</p>
        {message.attachment_paths.length > 0 ? (
          <ul
            className={cn(
              'mt-1 flex flex-wrap gap-1.5 text-xs',
              align === 'right' ? 'text-primary-foreground/90' : 'text-muted-foreground',
            )}
          >
            {message.attachment_paths.map((p) => (
              <AttachmentPill key={p} path={p} dark={align === 'right'} />
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

function SystemEntry({ message, authors }: { message: TicketMessage; authors: AuthorMap }) {
  const author = message.author_user_id ? authors[message.author_user_id] : null;
  const name = author?.full_name ?? author?.contact_email ?? 'System';
  const time = formatTime(message.created_at);
  const summary = formatSystem(message);

  return (
    <li className="flex justify-center">
      <div className="flex flex-wrap items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Settings2 className="h-3 w-3" />
        <span>{summary}</span>
        <span aria-hidden>·</span>
        <span>{name}</span>
        <span aria-hidden>·</span>
        <span>{time}</span>
      </div>
    </li>
  );
}

function AttachmentPill({ path, dark }: { path: string; dark: boolean }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const filename = filenameFromPath(path);

  const sign = async () => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setLoading(true);
    try {
      // ticket_id is the second segment — just send the path; the route
      // doesn't actually need the parsed id.
      const ticketId = path.split('/')[1] ?? '';
      const res = await fetch(`/api/tickets/${ticketId}/attachments/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { url: string };
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.data) {
        toast.error(json?.error?.message ?? 'Could not open attachment');
        return;
      }
      setUrl(json.data.url);
      window.open(json.data.url, '_blank', 'noopener,noreferrer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={sign}
        disabled={loading}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2 py-1',
          dark ? 'border-primary-foreground/30 hover:bg-primary-foreground/10' : 'hover:bg-muted',
        )}
      >
        <Paperclip className="h-3 w-3" />
        <span className="max-w-[16rem] truncate">{filename}</span>
      </button>
    </li>
  );
}

function formatSystem(message: TicketMessage): string {
  const meta = message.meta as Record<string, unknown>;
  switch (message.kind) {
    case 'system_status': {
      const from = (meta.from as string) ?? '';
      const to = (meta.to as string) ?? '';
      if (from && to) {
        return `Status: ${TICKET_STATUS_LABEL[from as keyof typeof TICKET_STATUS_LABEL] ?? from} → ${
          TICKET_STATUS_LABEL[to as keyof typeof TICKET_STATUS_LABEL] ?? to
        }`;
      }
      return 'Status changed';
    }
    case 'system_assigned': {
      const toUser = meta.to_user as string | null;
      const toContractor = meta.to_contractor as string | null;
      if (toContractor) return `Assigned to ${toContractor}`;
      if (toUser) return 'Assigned to a team member';
      return 'Unassigned';
    }
    case 'system_severity':
      return 'Severity changed';
    case 'system_note':
      return message.body;
    default:
      return 'Update';
  }
}

function filenameFromPath(path: string): string {
  const last = path.split('/').pop() ?? path;
  const dash = last.indexOf('-');
  return dash > 0 ? last.slice(dash + 1) : last;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
