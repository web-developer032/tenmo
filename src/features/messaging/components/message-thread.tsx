'use client';

import { ArrowDown, Check, CheckCheck, Loader2 } from 'lucide-react';
import * as React from 'react';
import type { ConversationParticipantView } from '@/core/schemas/messaging';
import { formatDayLabel, formatTimeOfDay } from '@/core/utils/dates';
import {
  groupMessagesByDay,
  type MessageReadStatus,
  messageReadStatus,
  participantDisplayName,
  senderColorClass,
  shouldAttachToPrev,
  visibleBody,
} from '@/core/utils/messaging-rules';
import { cn } from '@/lib/cn';
import type { OptimisticMessage } from '../hooks/use-conversation';

/**
 * Pure thread renderer.
 *
 * Receives messages + participants + optimistic state from the caller
 * (`useConversation`). Responsible for:
 *
 *   * Day separators (locale-stable via `formatDayLabel`).
 *   * Sender name + colour-tinted accent above the first bubble of
 *     each non-self sender run (the "attached" check below).
 *   * Read-receipt ticks on own bubbles — "sent" (single grey check)
 *     vs "read" (double blue check), driven by participants'
 *     `last_read_at`.
 *   * Smart auto-scroll: jumps to the latest message only when the
 *     viewer is already at-or-near the bottom or sent the message
 *     themselves; otherwise pops a floating "↓ new" chip so the
 *     reader's place isn't yanked while they're scrolled up looking
 *     at history.
 */
export function MessageThread({
  messages,
  selfId,
  loading,
  participants,
}: {
  messages: OptimisticMessage[];
  selfId: string;
  loading: boolean;
  participants: ConversationParticipantView[];
}) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const [pendingNewCount, setPendingNewCount] = React.useState(0);
  const lastSeenIdRef = React.useRef<string | null>(null);

  const lastMessage = messages[messages.length - 1];

  // Track scroll position so auto-scroll can be conditional. 80px slack
  // matches what most chat clients consider "near the bottom".
  const onScroll = React.useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    const atBottom = distanceFromBottom < 80;
    setIsAtBottom(atBottom);
    if (atBottom) setPendingNewCount(0);
  }, []);

  // On every new last-message, decide whether to follow or count.
  React.useEffect(() => {
    if (!lastMessage) return;
    const node = scrollRef.current;
    if (!node) return;

    const isOwn = lastMessage.sender_id === selfId;
    const wasAtBottom = isAtBottom;

    if (isOwn || wasAtBottom) {
      node.scrollTop = node.scrollHeight;
      setPendingNewCount(0);
    } else if (lastSeenIdRef.current !== lastMessage.id) {
      setPendingNewCount((c) => c + 1);
    }
    lastSeenIdRef.current = lastMessage.id;
  }, [lastMessage, selfId, isAtBottom]);

  const scrollToBottom = React.useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
    setPendingNewCount(0);
  }, []);

  if (loading && messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12 text-sm text-muted-foreground">
        No messages yet — say hello.
      </div>
    );
  }

  const days = groupMessagesByDay(messages);
  const participantsById = new Map(participants.map((p) => [p.user_id, p]));

  return (
    <div className="relative flex-1 overflow-hidden">
      <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto px-4 py-4">
        {days.map((day) => (
          <div key={day.isoDate} className="space-y-1">
            <DaySeparator iso={day.isoDate} />
            {day.messages.map((message, idx) => {
              const prev = day.messages[idx - 1];
              const attached = shouldAttachToPrev(prev, message);
              const isMe = message.sender_id === selfId;
              const sender = participantsById.get(message.sender_id);
              const showSenderName = !isMe && !attached;
              const status: MessageReadStatus = isMe
                ? messageReadStatus(message, participants, Boolean(message.__pending))
                : 'sent';
              return (
                <MessageBubble
                  key={message.id}
                  isMe={isMe}
                  attached={attached}
                  pending={Boolean(message.__pending)}
                  failed={Boolean(message.__failed)}
                  deleted={Boolean(message.deleted_at)}
                  createdAt={message.created_at}
                  body={visibleBody(message)}
                  senderName={
                    showSenderName ? (sender ? participantDisplayName(sender) : null) : null
                  }
                  senderId={showSenderName ? message.sender_id : null}
                  status={status}
                />
              );
            })}
          </div>
        ))}
      </div>

      {!isAtBottom && pendingNewCount > 0 ? (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute right-4 bottom-3 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground shadow-md transition-opacity hover:opacity-90"
          aria-label={`${pendingNewCount} new message${pendingNewCount === 1 ? '' : 's'} — scroll to latest`}
        >
          <ArrowDown className="h-3 w-3" />
          {pendingNewCount} new
        </button>
      ) : null}
    </div>
  );
}

function DaySeparator({ iso }: { iso: string }) {
  return (
    <div className="my-3 flex items-center gap-3 text-[10px] uppercase tracking-wide text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {formatDayLabel(iso)}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function MessageBubble({
  isMe,
  attached,
  pending,
  failed,
  deleted,
  createdAt,
  body,
  senderName,
  senderId,
  status,
}: {
  isMe: boolean;
  attached: boolean;
  pending: boolean;
  failed: boolean;
  deleted: boolean;
  createdAt: string;
  body: string;
  senderName: string | null;
  senderId: string | null;
  status: MessageReadStatus;
}) {
  const time = formatTimeOfDay(createdAt);
  return (
    <div
      className={cn(
        'flex flex-col',
        isMe ? 'items-end' : 'items-start',
        attached ? 'mt-0.5' : 'mt-2',
      )}
    >
      {senderName ? (
        <span
          className={cn(
            'mb-0.5 px-1 text-[11px] font-semibold',
            senderId ? senderColorClass(senderId) : 'text-muted-foreground',
          )}
        >
          {senderName}
        </span>
      ) : null}
      <div
        className={cn(
          'group max-w-[80%] rounded-2xl px-3 py-2 text-sm',
          isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
          deleted && 'italic opacity-60',
        )}
      >
        <div className="whitespace-pre-wrap break-words">{body}</div>
        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-[10px] opacity-70',
            isMe ? 'justify-end' : 'justify-start',
          )}
        >
          {pending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
          {failed ? <span className="font-medium text-destructive">failed</span> : null}
          <span>{time}</span>
          {isMe && !pending && !failed ? <ReadReceipt status={status} /> : null}
        </div>
      </div>
    </div>
  );
}

/**
 * One grey tick = the server has the row but at least one other
 * participant hasn't read it yet. Two ticks tinted blue = everyone has
 * read up to this message's `created_at`.
 */
function ReadReceipt({ status }: { status: MessageReadStatus }) {
  if (status === 'read') {
    return <CheckCheck className="h-3 w-3 text-sky-300 dark:text-sky-200" aria-label="Read" />;
  }
  return <Check className="h-3 w-3" aria-label="Sent" />;
}
