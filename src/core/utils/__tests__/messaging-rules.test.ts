import { describe, expect, it } from 'vitest';
import type { ConversationListItem, Message } from '@/core/schemas/messaging';
import {
  conversationDisplayTitle,
  groupMessagesByDay,
  isValidMessageBody,
  partyRoleLabel,
  previewLine,
  shouldAttachToPrev,
  visibleBody,
} from '../messaging-rules';

const baseConv = {
  conversation: {
    id: '11111111-1111-1111-1111-111111111111',
    org_id: '22222222-2222-2222-2222-222222222222',
    kind: 'direct' as const,
    tenancy_id: null,
    title: null,
    created_by: '33333333-3333-3333-3333-333333333333',
    created_at: '2026-04-26T10:00:00Z',
    last_message_at: '2026-04-26T10:00:00Z',
  },
  unread_count: 0,
  preview: null,
  others: [],
};

const message = (over: Partial<Message>): Message => ({
  id: '00000000-0000-0000-0000-000000000001',
  conversation_id: '11111111-1111-1111-1111-111111111111',
  sender_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  body: 'hello',
  created_at: '2026-04-26T10:00:00Z',
  deleted_at: null,
  edited_at: null,
  ...over,
});

describe('isValidMessageBody', () => {
  it('rejects empty / whitespace-only bodies', () => {
    expect(isValidMessageBody('')).toBe(false);
    expect(isValidMessageBody('   ')).toBe(false);
    expect(isValidMessageBody('\n\t')).toBe(false);
  });

  it('accepts a non-empty body within the limit', () => {
    expect(isValidMessageBody('hi')).toBe(true);
    expect(isValidMessageBody('a'.repeat(4000))).toBe(true);
  });

  it('rejects bodies longer than 4000 chars', () => {
    expect(isValidMessageBody('a'.repeat(4001))).toBe(false);
  });
});

describe('conversationDisplayTitle', () => {
  it('prefers explicit title when present', () => {
    const item: ConversationListItem = {
      ...baseConv,
      conversation: { ...baseConv.conversation, title: 'Old House — main thread' },
      others: [{ user_id: 'x', party_role: 'tenant', full_name: 'Bea', contact_email: null }],
    };
    expect(conversationDisplayTitle(item)).toBe('Old House — main thread');
  });

  it('falls back to other participants when title is empty', () => {
    const item: ConversationListItem = {
      ...baseConv,
      others: [
        { user_id: 'x', party_role: 'tenant', full_name: 'Bea Jones', contact_email: null },
        { user_id: 'y', party_role: 'tenant', full_name: null, contact_email: 'cara@example.com' },
      ],
    };
    expect(conversationDisplayTitle(item)).toBe('Bea Jones, cara@example.com');
  });

  it('returns Conversation when there are no other participants', () => {
    expect(conversationDisplayTitle(baseConv)).toBe('Conversation');
  });
});

describe('previewLine', () => {
  it('returns "No messages yet" for empty preview', () => {
    expect(previewLine(baseConv)).toBe('No messages yet');
  });

  it('shows [deleted message] when soft-deleted', () => {
    const item: ConversationListItem = {
      ...baseConv,
      preview: {
        sender_id: 'a',
        body: '',
        created_at: '2026-04-26T10:00:00Z',
        deleted: true,
      },
    };
    expect(previewLine(item)).toBe('[deleted message]');
  });

  it('collapses whitespace and truncates long bodies', () => {
    const long = 'word '.repeat(50);
    const item: ConversationListItem = {
      ...baseConv,
      preview: { sender_id: 'a', body: long, created_at: '', deleted: false },
    };
    const out = previewLine(item);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('partyRoleLabel', () => {
  it('humanises known roles', () => {
    expect(partyRoleLabel('landlord')).toBe('Landlord');
    expect(partyRoleLabel('tenant')).toBe('Tenant');
    expect(partyRoleLabel('agent')).toBe('Agent');
  });
});

describe('groupMessagesByDay', () => {
  it('groups messages from the same day together (caller-local TZ)', () => {
    const msgs = [
      message({ id: '1', created_at: '2026-04-26T10:00:00Z' }),
      message({ id: '2', created_at: '2026-04-26T18:00:00Z' }),
      message({ id: '3', created_at: '2026-04-27T08:00:00Z' }),
    ];
    const groups = groupMessagesByDay(msgs);
    expect(groups.length).toBe(2);
    expect(groups[0]?.messages.length).toBe(2);
    expect(groups[1]?.messages.length).toBe(1);
  });

  it('preserves extra fields on optimistic messages', () => {
    const optimistic = { ...message({ id: 'tmp_1' }), __pending: true };
    const groups = groupMessagesByDay([optimistic]);
    expect(groups[0]?.messages[0]).toMatchObject({ __pending: true });
  });
});

describe('shouldAttachToPrev', () => {
  const a = message({ id: 'a', sender_id: 'u1', created_at: '2026-04-26T10:00:00Z' });

  it('attaches when same sender within 5 minutes', () => {
    const b = message({ id: 'b', sender_id: 'u1', created_at: '2026-04-26T10:04:00Z' });
    expect(shouldAttachToPrev(a, b)).toBe(true);
  });

  it('detaches across senders', () => {
    const b = message({ id: 'b', sender_id: 'u2', created_at: '2026-04-26T10:01:00Z' });
    expect(shouldAttachToPrev(a, b)).toBe(false);
  });

  it('detaches when gap exceeds 5 minutes', () => {
    const b = message({ id: 'b', sender_id: 'u1', created_at: '2026-04-26T10:06:00Z' });
    expect(shouldAttachToPrev(a, b)).toBe(false);
  });

  it('detaches when there is no previous message', () => {
    expect(shouldAttachToPrev(undefined, a)).toBe(false);
  });
});

describe('visibleBody', () => {
  it('renders [deleted] for soft-deleted messages', () => {
    expect(visibleBody(message({ deleted_at: '2026-04-26T11:00:00Z' }))).toBe('[deleted]');
  });

  it('returns the body verbatim otherwise', () => {
    expect(visibleBody(message({ body: 'hi there' }))).toBe('hi there');
  });
});
