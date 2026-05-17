import { z } from 'zod';
import { ADMIN_EVENT_KIND_VALUES, type AdminEventKind } from '../constants/admin';
import { SubscriptionTierEnum } from './billing';
import { uuid } from './common';

/**
 * Admin domain schemas. Mirrors `public.admin_audit_log` and the
 * action input shapes for admin write endpoints.
 */

export const AdminEventKindEnum = z.enum(
  ADMIN_EVENT_KIND_VALUES as [AdminEventKind, ...AdminEventKind[]],
);

export const AdminAuditEntry = z.object({
  id: uuid,
  actor_user_id: uuid,
  event: AdminEventKindEnum,
  target_user_id: uuid.nullable(),
  target_org_id: uuid.nullable(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: z.string(),
});

export type AdminAuditEntry = z.infer<typeof AdminAuditEntry>;

/** Body for `POST /api/admin/orgs/[orgId]/subscription-override`.
 * Pass `tier=null` to clear the override. */
export const SubscriptionOverrideInput = z
  .object({
    tier: SubscriptionTierEnum.nullable(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export type SubscriptionOverrideInput = z.infer<typeof SubscriptionOverrideInput>;

/** Body for `POST /api/admin/users/[userId]/notes`. */
export const SupportNoteInput = z
  .object({
    note: z.string().trim().min(3).max(2000),
  })
  .strict();

export type SupportNoteInput = z.infer<typeof SupportNoteInput>;

/** Query for the paginated list endpoints. */
export const AdminListQuery = z
  .object({
    q: z.string().trim().max(120).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    per_page: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export type AdminListQuery = z.infer<typeof AdminListQuery>;
