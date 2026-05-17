/**
 * Browser API client for in-app messaging.
 *
 * Mirrors the notifications client — thin fetch wrappers, common
 * envelope unwrap, and a typed error class so the UI can `instanceof`
 * for status-code branching.
 */

import type {
  ConversationListItem,
  ConversationParticipantView,
  FindOrCreateDirectInput,
  Message,
  SendMessageInput,
} from '@/core/schemas/messaging';

export type InboxResponse = {
  conversations: ConversationListItem[];
  unread_total: number;
};

class MessagingApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'MessagingApiError';
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string };
  } | null;
  if (!res.ok || !json || !('data' in json) || json.data === undefined) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    throw new MessagingApiError(msg, res.status);
  }
  return json.data as T;
}

export async function fetchInbox(): Promise<InboxResponse> {
  const res = await fetch('/api/conversations', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  return unwrap<InboxResponse>(res);
}

export async function findOrCreateDirect(input: FindOrCreateDirectInput): Promise<string> {
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(input),
  });
  const data = await unwrap<{ conversation_id: string }>(res);
  return data.conversation_id;
}

export async function fetchMessages(
  conversationId: string,
  opts?: { limit?: number; before?: string },
): Promise<Message[]> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.before) params.set('before', opts.before);
  const qs = params.toString();
  const res = await fetch(`/api/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await unwrap<{ messages: Message[] }>(res);
  return data.messages;
}

export async function sendMessageApi(input: SendMessageInput): Promise<Message> {
  const res = await fetch(`/api/conversations/${input.conversation_id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ body: input.body }),
  });
  const data = await unwrap<{ message: Message }>(res);
  return data.message;
}

export async function fetchConversationParticipants(
  conversationId: string,
): Promise<ConversationParticipantView[]> {
  const res = await fetch(`/api/conversations/${conversationId}/participants`, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await unwrap<{ participants: ConversationParticipantView[] }>(res);
  return data.participants;
}

export async function markConversationReadApi(conversationId: string): Promise<string> {
  const res = await fetch(`/api/conversations/${conversationId}/read`, {
    method: 'PATCH',
    credentials: 'same-origin',
  });
  const data = await unwrap<{ last_read_at: string }>(res);
  return data.last_read_at;
}

export { MessagingApiError };
