'use client';

import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import type { ConversationListItem } from '@/core/schemas/messaging';
import { formatShortDate, formatTimeOfDay } from '@/core/utils/dates';
import { conversationDisplayTitle, previewLine } from '@/core/utils/messaging-rules';
import { cn } from '@/lib/cn';

/**
 * Inbox list — one row per conversation.
 *
 * Highlights:
 *   * Unread badge (capped at 99+).
 *   * Bold title + preview when there are unread messages.
 *   * Relative timestamp on the right (today: HH:mm, this year: dd MMM, else dd MMM yy).
 */
export function ConversationList({
  items,
  activeId,
  emptyMessage = 'No conversations yet.',
}: {
  items: ConversationListItem[];
  activeId?: string | null;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground">
        <MessageSquare className="h-6 w-6 opacity-40" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {items.map((item) => {
        const title = conversationDisplayTitle(item);
        const preview = previewLine(item);
        const unread = item.unread_count;
        const isActive = activeId === item.conversation.id;
        const ts = formatTs(item.conversation.last_message_at);
        return (
          <li key={item.conversation.id}>
            <Link
              href={`/messages/${item.conversation.id}`}
              prefetch={false}
              className={cn(
                'flex w-full flex-col gap-0.5 px-3 py-3 transition-colors hover:bg-accent/40',
                isActive && 'bg-accent/60',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn('truncate text-sm', unread > 0 ? 'font-semibold' : 'font-medium')}
                >
                  {title}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{ts}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'truncate text-xs',
                    unread > 0 ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {preview}
                </span>
                {unread > 0 ? (
                  <span className="inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {unread > 99 ? '99+' : unread}
                  </span>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Inbox-row timestamp:
 *   - same calendar day → 24-hour "HH:mm"
 *   - same year         → "03 May"
 *   - else              → "03 May 25"
 *
 * Uses the shared `en-GB`-default formatters so SSR + CSR produce the
 * same string (no hydration mismatch).
 */
function formatTs(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const now = new Date();
  const sameDay =
    dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate();
  if (sameDay) return formatTimeOfDay(iso);
  return formatShortDate(iso, undefined, now);
}
