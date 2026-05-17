import { z } from 'zod';
import { dateIso, pence, uuid } from './common';

/**
 * Tenancy — relationship of a `tenant_user_id` with a room (or property).
 * Represents the legal occupation, not the user.
 */
export const TenancyStatus = z.enum([
  'draft',
  'pending_invite',
  'awaiting_signature',
  'awaiting_deposit',
  'active',
  'ended',
  'cancelled',
]);
export type TenancyStatus = z.infer<typeof TenancyStatus>;

export const RentFrequency = z.enum(['monthly', 'weekly']);
export type RentFrequency = z.infer<typeof RentFrequency>;

export const DepositScheme = z.enum(['dps', 'mydeposits', 'tds']);
export type DepositScheme = z.infer<typeof DepositScheme>;

export const Tenancy = z.object({
  id: uuid,
  org_id: uuid,
  property_id: uuid,
  room_id: uuid.nullable(),
  tenant_user_id: uuid.nullable(),
  invite_email: z.string().email().nullable(),
  invite_token: z.string().nullable(),
  status: TenancyStatus,
  is_periodic: z.boolean().default(true),
  start_date: dateIso,
  end_date: dateIso.nullable(),
  rent_pence: pence,
  rent_currency: z.string().default('GBP'),
  rent_frequency: RentFrequency.default('monthly'),
  rent_due_day: z.number().int().min(1).max(31).default(1),
  deposit_pence: pence,
  deposit_scheme: DepositScheme.nullable(),
  deposit_reference: z.string().nullable(),
  deposit_protected_at: z.string().nullable(),
  prescribed_information_sent_at: z.string().nullable(),
  ast_signed_at: z.string().nullable(),
  ast_document_path: z.string().nullable(),
  rtr_check_completed_at: z.string().nullable(),
  ended_at: z.string().nullable(),
  end_reason: z.string().nullable(),
  notes: z.string().nullable(),
  created_by: uuid,
  created_at: z.string(),
  updated_at: z.string(),
});
export type Tenancy = z.infer<typeof Tenancy>;

/** Schema for issuing a new tenancy invite. */
export const TenancyInvite = z.object({
  property_id: uuid,
  room_id: uuid.optional().nullable(),
  invite_email: z.string().email(),
  start_date: dateIso,
  rent_pence: pence,
  rent_frequency: RentFrequency.default('monthly'),
  rent_due_day: z.number().int().min(1).max(31).default(1),
  deposit_pence: pence,
  deposit_scheme: DepositScheme,
});
export type TenancyInvite = z.infer<typeof TenancyInvite>;

/**
 * Public preview of a pending invite (returned by `preview_tenancy_invite`).
 * No internal IDs that aren't strictly needed by the recipient.
 */
export const TenancyInvitePreview = z.object({
  tenancy_id: uuid,
  status: TenancyStatus,
  invite_email: z.string().email(),
  invite_expires_at: z.string().nullable(),
  property_name: z.string(),
  property_address: z
    .object({
      line1: z.string(),
      line2: z.string().optional().nullable(),
      city: z.string(),
      postcode: z.string(),
      country: z.string().default('GB'),
    })
    .partial()
    .passthrough(),
  room_name: z.string().nullable(),
  org_name: z.string(),
  start_date: dateIso,
  rent_pence: pence,
  rent_frequency: RentFrequency,
  deposit_pence: pence,
});
export type TenancyInvitePreview = z.infer<typeof TenancyInvitePreview>;

/** Tenant accepts an invite — only the token is needed; auth is the user. */
export const TenancyAccept = z.object({
  token: z.string().min(8).max(64),
});
export type TenancyAccept = z.infer<typeof TenancyAccept>;

/**
 * End-tenancy reason codes — narrow set surfaced to the UI. Note that
 * Section 21 (no-fault) is intentionally absent: it is abolished by the
 * Renters' Rights Bill.
 */
export const TenancyEndReason = z.enum([
  'tenant_notice',
  'mutual_break',
  'rent_arrears',
  'antisocial_behaviour',
  'breach_of_terms',
  'landlord_moving_in',
  'sale_of_property',
  'other',
]);
export type TenancyEndReason = z.infer<typeof TenancyEndReason>;

/** Schema to end a tenancy. */
export const TenancyEnd = z.object({
  end_date: dateIso,
  reason: TenancyEndReason,
  notes: z.string().max(1000).optional().nullable(),
});
export type TenancyEnd = z.infer<typeof TenancyEnd>;

/**
 * Active states are anything other than `draft`, `cancelled`, `ended`.
 * Used widely in queries — keep in sync with `tenancy_status` enum.
 */
export const ACTIVE_TENANCY_STATUSES = [
  'pending_invite',
  'awaiting_signature',
  'awaiting_deposit',
  'active',
] as const satisfies readonly TenancyStatus[];

export function isActiveTenancyStatus(status: TenancyStatus): boolean {
  return (ACTIVE_TENANCY_STATUSES as readonly string[]).includes(status);
}
