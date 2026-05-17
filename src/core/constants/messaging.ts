/**
 * Messaging domain — kinds, role labels, payload limits.
 *
 * Source of truth for the database enum `conversation_kind` (see
 * migration `20260101001500_messaging.sql`) and the threading UI.
 */

export type ConversationKind = 'direct' | 'tenancy';

export const CONVERSATION_KIND_VALUES: ConversationKind[] = ['direct', 'tenancy'];

/** Snapshot of who a participant was at the time of joining — drives
 * "Tenant" / "Landlord" tags on message bubbles without requiring an
 * org_memberships join. */
export type PartyRole = 'landlord' | 'agent' | 'staff' | 'tenant' | 'member';

export const PARTY_ROLE_VALUES: PartyRole[] = ['landlord', 'agent', 'staff', 'tenant', 'member'];

export const PARTY_ROLE_LABEL: Record<PartyRole, string> = {
  landlord: 'Landlord',
  agent: 'Agent',
  staff: 'Staff',
  tenant: 'Tenant',
  member: 'Member',
};

/** Hard limit enforced by the database `messages.body` CHECK constraint. */
export const MESSAGE_MAX_LENGTH = 4000;

/** Default page sizes. */
export const CONVERSATION_PAGE_SIZE = 30;
export const MESSAGE_PAGE_SIZE = 50;
