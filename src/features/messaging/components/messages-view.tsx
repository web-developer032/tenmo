'use client';

import { ChevronLeft, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Card } from '@/components/ui/card';
import type { ConversationParticipantView, Message } from '@/core/schemas/messaging';
import {
  conversationDisplayTitle,
  participantDisplayName,
  partyRoleLabel,
} from '@/core/utils/messaging-rules';
import { cn } from '@/lib/cn';
import type { InboxResponse } from '../api/client';
import type { TypingParticipant } from '../hooks/use-conversation';
import { useConversation } from '../hooks/use-conversation';
import { useInbox } from '../hooks/use-inbox';
import type { MessageCandidate } from '../server/list-message-candidates';
import { ConversationList } from './conversation-list';
import { MessageComposer } from './message-composer';
import { MessageThread } from './message-thread';
import { NewConversationDialog } from './new-conversation-dialog';

/**
 * Composed inbox + thread view.
 *
 * Layout:
 *   * desktop (md+): two-column split (inbox 320px / thread fills).
 *   * mobile: single column. When `activeId` is set we show the thread
 *     and a back-link; otherwise the inbox.
 *
 * State ownership:
 *   * `useInbox` keeps the conversation list + unread totals fresh.
 *   * `useConversation` (only when `activeId` is set) drives the thread,
 *     including read receipts (other participants' `last_read_at`) and
 *     typing indicators (Supabase Realtime broadcast).
 *
 * Initial server-rendered data avoids the empty-flash on first paint.
 */
export function MessagesView({
  userId,
  initialInbox,
  initialThread,
  initialParticipants,
  activeId,
  composeOrgId,
  composeCandidates,
}: {
  userId: string;
  initialInbox: InboxResponse;
  initialThread?: Message[];
  initialParticipants?: ConversationParticipantView[];
  activeId?: string | null;
  composeOrgId?: string | null;
  composeCandidates?: MessageCandidate[];
}) {
  const inbox = useInbox({ userId, initial: initialInbox });

  const activeItem = activeId
    ? (inbox.data.conversations.find((c) => c.conversation.id === activeId) ?? null)
    : null;

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-screen-2xl overflow-hidden border border-border-soft bg-white">
      <aside
        className={cn(
          'flex w-full flex-col border-r border-border-soft bg-white md:w-[300px]',
          activeId && 'hidden md:flex',
        )}
      >
        <header className="flex items-center justify-between gap-2 border-b border-border-soft px-4 py-3">
          <div className="min-w-0">
            <h1 className="font-sans text-[14px] font-bold tracking-tight text-ink">Messages</h1>
            <span className="text-[11px] text-ink-light">
              {inbox.data.unread_total > 0
                ? `${inbox.data.unread_total} unread`
                : `${inbox.data.conversations.length} total`}
            </span>
          </div>
          {composeOrgId ? (
            <NewConversationDialog orgId={composeOrgId} candidates={composeCandidates ?? []} />
          ) : null}
        </header>
        <div className="flex-1 overflow-y-auto">
          {inbox.error ? (
            <div className="px-4 py-6 text-sm text-destructive">{inbox.error}</div>
          ) : (
            <ConversationList items={inbox.data.conversations} activeId={activeId ?? undefined} />
          )}
        </div>
      </aside>

      <section className={cn('flex flex-1 flex-col bg-white', !activeId && 'hidden md:flex')}>
        {activeId ? (
          <ActiveThread
            key={activeId}
            conversationId={activeId}
            selfId={userId}
            title={activeItem ? conversationDisplayTitle(activeItem) : 'Conversation'}
            subtitle={
              activeItem
                ? activeItem.others
                    .map((o) => partyRoleLabel(o.party_role))
                    .filter((v, i, arr) => arr.indexOf(v) === i)
                    .join(' · ')
                : ''
            }
            initialMessages={initialThread}
            initialParticipants={initialParticipants}
          />
        ) : (
          <EmptyState />
        )}
      </section>
    </div>
  );
}

function ActiveThread({
  conversationId,
  selfId,
  title,
  subtitle,
  initialMessages,
  initialParticipants,
}: {
  conversationId: string;
  selfId: string;
  title: string;
  subtitle: string;
  initialMessages?: Message[];
  initialParticipants?: ConversationParticipantView[];
}) {
  const router = useRouter();

  const selfName = React.useMemo(
    () =>
      initialParticipants?.find((p) => p.is_self)
        ? participantDisplayName(
            initialParticipants.find((p) => p.is_self) as ConversationParticipantView,
          )
        : null,
    [initialParticipants],
  );

  const conv = useConversation({
    conversationId,
    selfId,
    selfName,
    initialParticipants,
  });

  // Seed with server-rendered messages until the hook's first fetch
  // lands. After that the hook is the single source of truth (it owns
  // optimistic sends + realtime patches).
  const messages =
    conv.messages.length === 0 && initialMessages && initialMessages.length > 0
      ? initialMessages
      : conv.messages;

  const headerInitials = initialsFrom(title);

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border-soft px-4 py-3">
        <button
          type="button"
          onClick={() => router.push('/messages')}
          className="-ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-light hover:bg-stone-100 md:hidden"
          aria-label="Back to inbox"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-600 font-sans text-[12px] font-bold uppercase tracking-tight text-white"
          aria-hidden="true"
        >
          {headerInitials}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-sans text-[14px] font-bold tracking-tight text-ink">
            {title}
          </h2>
          {subtitle ? <p className="truncate text-[11px] text-ink-light">{subtitle}</p> : null}
        </div>
      </header>
      <MessageThread
        messages={messages}
        selfId={selfId}
        loading={conv.loading}
        participants={conv.participants}
      />
      <TypingStrip typers={conv.typingUsers} />
      {conv.error ? (
        <p className="border-t bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {conv.error}
        </p>
      ) : null}
      <MessageComposer
        onSend={(body) => conv.send(body)}
        onTyping={conv.notifyTyping}
        sending={conv.sending}
      />
    </>
  );
}

/**
 * Thin strip just above the composer that announces remote typers.
 * Renders nothing when no one is typing — keeps the layout stable
 * (the composer below uses `border-t` as its visual divider).
 */
function TypingStrip({ typers }: { typers: TypingParticipant[] }) {
  if (typers.length === 0) return null;
  const names = typers.map((t) => t.fullName.trim() || 'Someone').filter(Boolean);
  const label =
    names.length === 1
      ? `${names[0]} is typing…`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing…`
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are typing…`;
  return (
    <div className="px-4 pb-1 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        {label}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="flex max-w-sm flex-col items-center gap-3 px-8 py-10 text-center">
        <MessageSquare className="h-8 w-8 text-ink-light" />
        <h2 className="font-sans text-[16px] font-bold tracking-tight text-ink">
          Pick a conversation
        </h2>
        <p className="text-[13px] text-ink-light">
          Direct messages between landlords and tenants land here. New tenancy threads are created
          automatically as soon as a tenant accepts an invite.
        </p>
        <Link
          href="/notifications"
          className="text-[12px] font-medium text-forest-700 hover:underline"
        >
          See notifications
        </Link>
      </Card>
    </div>
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
