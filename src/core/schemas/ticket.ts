import { z } from 'zod';
import {
  TICKET_CATEGORY_VALUES,
  TICKET_SEVERITY_VALUES,
  TICKET_STATUS_VALUES,
  type TicketCategory,
  type TicketSeverity,
  type TicketStatus,
} from '../constants/tickets';
import { uuid } from './common';

/**
 * Maintenance ticket schemas.
 *
 * Mirror the database tables `tickets` and `ticket_messages` (see
 * migration `20260101001000_tickets.sql`). Use these for parsing rows
 * returned from Supabase, server-side validation, and form schemas.
 */

export const TicketCategoryEnum = z.enum(
  TICKET_CATEGORY_VALUES as [TicketCategory, ...TicketCategory[]],
);
export const TicketSeverityEnum = z.enum(
  TICKET_SEVERITY_VALUES as [TicketSeverity, ...TicketSeverity[]],
);
export const TicketStatusEnum = z.enum(TICKET_STATUS_VALUES as [TicketStatus, ...TicketStatus[]]);

export const TicketMessageKindEnum = z.enum([
  'comment',
  'system_status',
  'system_assigned',
  'system_severity',
  'system_note',
]);
export type TicketMessageKindEnum = z.infer<typeof TicketMessageKindEnum>;

/** A single ticket row. */
export const Ticket = z.object({
  id: uuid,
  org_id: uuid,
  property_id: uuid,
  room_id: uuid.nullable(),
  tenancy_id: uuid.nullable(),

  title: z.string(),
  description: z.string(),

  category: TicketCategoryEnum,
  severity: TicketSeverityEnum,
  status: TicketStatusEnum,

  assigned_to_user_id: uuid.nullable(),
  assigned_contractor: z.string().nullable(),

  first_response_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  reopened_count: z.number().int().min(0),

  ai_suggested_category: TicketCategoryEnum.nullable(),
  ai_suggested_severity: TicketSeverityEnum.nullable(),
  ai_triage_reason: z.string().nullable(),

  created_by: uuid,
  created_at: z.string(),
  updated_at: z.string(),
});
export type Ticket = z.infer<typeof Ticket>;

/** A single message row. */
export const TicketMessage = z.object({
  id: uuid,
  org_id: uuid,
  ticket_id: uuid,
  author_user_id: uuid.nullable(),
  kind: TicketMessageKindEnum,
  body: z.string(),
  attachment_paths: z.array(z.string()).default([]),
  meta: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string(),
});
export type TicketMessage = z.infer<typeof TicketMessage>;

/** Input for creating a ticket — used by both the tenant form and API route. */
export const CreateTicketInput = z.object({
  property_id: uuid,
  room_id: uuid.optional().nullable(),
  tenancy_id: uuid.optional().nullable(),
  title: z.string().trim().min(3, 'A short title helps.').max(140),
  description: z.string().trim().min(10, 'Tell us a bit more.').max(5000),
  category: TicketCategoryEnum.optional(),
  severity: TicketSeverityEnum.optional(),
  /** Storage paths the client has already uploaded to ticket-attachments. */
  attachment_paths: z.array(z.string()).max(10).default([]),
});
export type CreateTicketInput = z.infer<typeof CreateTicketInput>;

/** Input for adding a message to an existing ticket. */
export const AddTicketMessageInput = z.object({
  body: z.string().trim().min(1, 'Say something.').max(5000),
  attachment_paths: z.array(z.string()).max(10).default([]),
});
export type AddTicketMessageInput = z.infer<typeof AddTicketMessageInput>;

export const ChangeTicketStatusInput = z.object({
  status: TicketStatusEnum,
  note: z.string().trim().max(2000).optional().nullable(),
});
export type ChangeTicketStatusInput = z.infer<typeof ChangeTicketStatusInput>;

export const AssignTicketInput = z.object({
  assigned_to_user_id: uuid.optional().nullable(),
  assigned_contractor: z.string().trim().min(1).max(140).optional().nullable(),
});
export type AssignTicketInput = z.infer<typeof AssignTicketInput>;

export const TicketListFilter = z.object({
  status: TicketStatusEnum.optional(),
  severity: TicketSeverityEnum.optional(),
  category: TicketCategoryEnum.optional(),
  property_id: uuid.optional(),
  tenancy_id: uuid.optional(),
  assigned_to_user_id: uuid.optional(),
  open_only: z.boolean().optional(),
});
export type TicketListFilter = z.infer<typeof TicketListFilter>;
