import { MESSAGE_MAX_LENGTH, PARTY_ROLE_LABEL, type PartyRole } from '../constants/messaging';
import type {
  ConversationListItem,
  ConversationParticipantView,
  Message,
} from '../schemas/messaging';

/**
 * Pure helpers for the messaging UI.
 *
 * Lives in `core/` (no React, no Next, no Supabase imports) so the same
 * logic can power the web app, the future Expo app, and server-side
 * notification copy.
 */

/** True when the body is non-empty after trim and within the DB limit. */
export function isValidMessageBody(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.length >= 1 && trimmed.length <= MESSAGE_MAX_LENGTH;
}

/** Title shown in the inbox row + thread header.
 *
 * For tenancy conversations: prefer the conversation `title` (set by
 * staff if any), otherwise fall back to the other participants' names.
 * For direct conversations: just the other participants' names. */
export function conversationDisplayTitle(item: ConversationListItem): string {
  if (item.conversation.title?.trim()) return item.conversation.title;
  const others = item.others
    .map((o) => o.full_name?.trim() || o.contact_email || 'Unknown')
    .filter(Boolean);
  if (others.length === 0) return 'Conversation';
  return others.join(', ');
}

/** Compact preview — replaces `[deleted]` for soft-deleted messages,
 * truncates long bodies. */
export function previewLine(item: ConversationListItem): string {
  if (!item.preview) return 'No messages yet';
  if (item.preview.deleted) return '[deleted message]';
  const oneLine = item.preview.body.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= 80) return oneLine;
  return `${oneLine.slice(0, 77)}…`;
}

/** Human-friendly party role label. */
export function partyRoleLabel(role: PartyRole): string {
  return PARTY_ROLE_LABEL[role] ?? role;
}

/** Minimum shape required by the thread renderer. Loose enough to
 * accept both `Message` and `OptimisticMessage` (the hook's locally-
 * pending shape) without forcing the helpers to know about the UI. */
export type ThreadMessage = Pick<
  Message,
  'id' | 'sender_id' | 'body' | 'created_at' | 'deleted_at'
>;

/** Group messages by calendar day (ISO `YYYY-MM-DD` in the caller's
 * local timezone) so the thread can render day separators without
 * recomputing per render. */
export function groupMessagesByDay<M extends ThreadMessage>(
  messages: M[],
): Array<{
  isoDate: string;
  messages: M[];
}> {
  const groups: Array<{ isoDate: string; messages: M[] }> = [];
  for (const message of messages) {
    const date = new Date(message.created_at);
    const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const last = groups[groups.length - 1];
    if (last && last.isoDate === isoDate) {
      last.messages.push(message);
    } else {
      groups.push({ isoDate, messages: [message] });
    }
  }
  return groups;
}

/** Should the message bubble be visually attached to the previous one?
 * Used by the thread renderer to drop avatars / timestamps for runs of
 * messages from the same sender within 5 minutes. */
export function shouldAttachToPrev(
  prev: ThreadMessage | undefined,
  current: ThreadMessage,
): boolean {
  if (!prev) return false;
  if (prev.sender_id !== current.sender_id) return false;
  const dt = new Date(current.created_at).getTime() - new Date(prev.created_at).getTime();
  return dt < 5 * 60 * 1000;
}

/** Render the visible body for a (possibly soft-deleted) message. */
export function visibleBody(message: ThreadMessage): string {
  if (message.deleted_at) return '[deleted]';
  return message.body;
}

/**
 * Display name for a participant — preferred name → full name → email →
 * "Unknown". Pure; no React imports.
 */
export function participantDisplayName(p: {
  full_name: string | null;
  contact_email: string | null;
}): string {
  return p.full_name?.trim() || p.contact_email?.trim() || 'Unknown';
}

/**
 * WhatsApp-style read state for a single message.
 *
 *   - `'sent'`  — server has the row (we have an id) but at least one
 *                 non-self participant's `last_read_at` is older than
 *                 the message's `created_at`.
 *   - `'read'`  — every non-self participant has read at or after the
 *                 message's `created_at`.
 *
 * Pure: takes a snapshot of participants and returns a simple enum so
 * the renderer can stay dumb. For 1-1 conversations, `'read'` means the
 * one other person read it; for groups, it means everyone has.
 */
export type MessageReadStatus = 'sent' | 'read';

export function messageReadStatus(
  message: Pick<Message, 'id' | 'created_at'>,
  participants: ReadonlyArray<Pick<ConversationParticipantView, 'is_self' | 'last_read_at'>>,
  /** Optimistic / pending messages have a temp id and are reported as `'sent'`. */
  isPending: boolean,
): MessageReadStatus {
  if (isPending) return 'sent';
  const others = participants.filter((p) => !p.is_self);
  if (others.length === 0) return 'sent';
  const created = new Date(message.created_at).getTime();
  const allRead = others.every((p) => new Date(p.last_read_at).getTime() >= created);
  return allRead ? 'read' : 'sent';
}

/**
 * Deterministic Tailwind text colour for a given user id — used to tint
 * sender-name labels above non-self bubbles in group chats. Six colours
 * cycled via a tiny FNV-1a-style hash so the same user always renders
 * with the same accent in the same conversation, but no two adjacent
 * users are guaranteed to clash.
 */
const SENDER_COLOR_CLASSES = [
  'text-emerald-600 dark:text-emerald-400',
  'text-sky-600 dark:text-sky-400',
  'text-violet-600 dark:text-violet-400',
  'text-amber-600 dark:text-amber-400',
  'text-rose-600 dark:text-rose-400',
  'text-teal-600 dark:text-teal-400',
] as const;

export function senderColorClass(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return SENDER_COLOR_CLASSES[hash % SENDER_COLOR_CLASSES.length] ?? SENDER_COLOR_CLASSES[0];
}
