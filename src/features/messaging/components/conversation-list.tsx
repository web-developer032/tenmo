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
    <ul className="divide-y divide-border-soft">
      {items.map((item) => {
        const title = conversationDisplayTitle(item);
        const preview = previewLine(item);
        const unread = item.unread_count;
        const isActive = activeId === item.conversation.id;
        const ts = formatTs(item.conversation.last_message_at);
        const initials = initialsFrom(title);
        return (
          <li key={item.conversation.id}>
            <Link
              href={`/messages/${item.conversation.id}`}
              prefetch={false}
              className={cn(
                'flex w-full items-center gap-3 px-3.5 py-3 transition-colors hover:bg-stone-50',
                isActive && 'bg-forest-50/60',
              )}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-600 font-sans text-[11px] font-bold uppercase tracking-tight text-white"
                aria-hidden="true"
              >
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'truncate text-[13px]',
                      unread > 0 ? 'font-bold text-ink' : 'font-semibold text-ink',
                    )}
                  >
                    {title}
                  </span>
                  <span className="shrink-0 text-[10px] text-ink-light">{ts}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'truncate text-[12px]',
                      unread > 0 ? 'text-ink' : 'text-ink-light',
                    )}
                  >
                    {preview}
                  </span>
                  {unread > 0 ? (
                    <span
                      role="status"
                      aria-label={`${unread > 99 ? '99+' : unread} unread`}
                      className="ml-1 inline-flex h-2 w-2 shrink-0 items-center justify-center rounded-full bg-forest-600"
                    />
                  ) : null}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function initialsFrom(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
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
