import { z } from 'zod';
import {
  CONVERSATION_KIND_VALUES,
  type ConversationKind,
  MESSAGE_MAX_LENGTH,
  PARTY_ROLE_VALUES,
  type PartyRole,
} from '../constants/messaging';
import { uuid } from './common';

/**
 * Messaging schemas.
 *
 * Mirrors the `public.conversations`, `public.conversation_participants`,
 * and `public.messages` tables.
 */

export const ConversationKindEnum = z.enum(
  CONVERSATION_KIND_VALUES as [ConversationKind, ...ConversationKind[]],
);

export const PartyRoleEnum = z.enum(PARTY_ROLE_VALUES as [PartyRole, ...PartyRole[]]);

export const ConversationParticipant = z.object({
  conversation_id: uuid,
  user_id: uuid,
  joined_at: z.string(),
  last_read_at: z.string(),
  party_role: PartyRoleEnum,
});

export type ConversationParticipant = z.infer<typeof ConversationParticipant>;

/**
 * Active-thread participant snapshot — what the conversation page hands
 * to the thread renderer so it can label senders, render read-receipt
 * ticks, and show typing indicators with names rather than raw user_ids.
 */
export const ConversationParticipantView = z.object({
  user_id: uuid,
  full_name: z.string().nullable(),
  contact_email: z.string().nullable(),
  party_role: PartyRoleEnum,
  last_read_at: z.string(),
  is_self: z.boolean(),
});

export type ConversationParticipantView = z.infer<typeof ConversationParticipantView>;

export const Conversation = z.object({
  id: uuid,
  org_id: uuid,
  kind: ConversationKindEnum,
  tenancy_id: uuid.nullable(),
  title: z.string().nullable(),
  created_by: uuid,
  created_at: z.string(),
  last_message_at: z.string(),
});

export type Conversation = z.infer<typeof Conversation>;

export const Message = z.object({
  id: uuid,
  conversation_id: uuid,
  sender_id: uuid,
  body: z.string(),
  created_at: z.string(),
  deleted_at: z.string().nullable(),
  edited_at: z.string().nullable(),
});

export type Message = z.infer<typeof Message>;

/** Composed view returned by the inbox — a conversation + the
 * counterparty profile snippet + unread + preview. */
export const ConversationListItem = z.object({
  conversation: Conversation,
  unread_count: z.number().int().nonnegative(),
  preview: z
    .object({
      sender_id: uuid,
      body: z.string(),
      created_at: z.string(),
      deleted: z.boolean(),
    })
    .nullable(),
  /** The other participants (everyone except the caller). */
  others: z.array(
    z.object({
      user_id: uuid,
      party_role: PartyRoleEnum,
      full_name: z.string().nullable(),
      contact_email: z.string().nullable(),
    }),
  ),
});

export type ConversationListItem = z.infer<typeof ConversationListItem>;

export const SendMessageInput = z.object({
  conversation_id: uuid,
  body: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH, 'Message too long'),
});

export type SendMessageInput = z.infer<typeof SendMessageInput>;

export const FindOrCreateDirectInput = z.object({
  org_id: uuid,
  other_user_id: uuid,
});

export type FindOrCreateDirectInput = z.infer<typeof FindOrCreateDirectInput>;

export const ListMessagesQuery = z.object({
  conversation_id: uuid,
  limit: z.number().int().min(1).max(200).default(50),
  before: z.string().optional(),
});

export type ListMessagesQuery = z.infer<typeof ListMessagesQuery>;
