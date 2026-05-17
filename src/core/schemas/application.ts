import { z } from 'zod';
import {
  APPLICATION_DECLINE_REASON_ROOM_FILLED,
  APPLICATION_STATUS_VALUES,
} from '../constants/listings';
import { dateIso, optionalString, pence, uuid } from './common';

/**
 * Application — Phase Q.
 *
 * One row per (room, applicant). The `room_applications` table preserves
 * historic rows after a decision so a tenant who was rejected can re-apply
 * later, and so the audit log is complete.
 */

export const ApplicationStatus = z.enum(
  APPLICATION_STATUS_VALUES as unknown as [string, ...string[]],
);
export type ApplicationStatus = z.infer<typeof ApplicationStatus>;

/** Wire shape returned to landlord + applicant views. */
export const Application = z.object({
  id: uuid,
  room_id: uuid,
  applicant_user_id: uuid,
  status: ApplicationStatus,
  message: z.string().nullable(),
  applied_at: z.string(),
  decided_at: z.string().nullable(),
  decided_by_user_id: uuid.nullable(),
  decline_reason: z.string().nullable(),
  resulting_tenancy_id: uuid.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Application = z.infer<typeof Application>;

/** What a tenant POSTs when applying for a room. */
export const ApplicationCreate = z.object({
  message: optionalString(z.string().trim().min(1).max(2000)),
});
export type ApplicationCreate = z.infer<typeof ApplicationCreate>;

/**
 * Landlord accept input. The accept transaction also creates a tenancy in
 * `pending_invite`, so the form must collect the same minimum set of fields
 * the existing tenancy create form needs (start date, rent, deposit, scheme).
 */
export const ApplicationAcceptInput = z.object({
  start_date: dateIso,
  rent_pence: pence,
  rent_frequency: z.enum(['monthly', 'weekly']).default('monthly'),
  rent_due_day: z.number().int().min(1).max(31).default(1),
  deposit_pence: pence.default(0),
  deposit_scheme: z.enum(['dps', 'mydeposits', 'tds']).optional().nullable(),
  is_periodic: z.boolean().default(true),
  end_date: optionalString(dateIso),
  notes: optionalString(z.string().trim().max(1000)),
});
export type ApplicationAcceptInput = z.infer<typeof ApplicationAcceptInput>;

/** Landlord reject input — decline_reason is mandatory at the DB level. */
export const ApplicationRejectInput = z.object({
  decline_reason: z.string().trim().min(1).max(500).default('Not selected for this room.'),
});
export type ApplicationRejectInput = z.infer<typeof ApplicationRejectInput>;

/** Convenience: did the auto-reject sibling trigger create this row? */
export function isRoomFilledRejection(application: Pick<Application, 'decline_reason'>): boolean {
  return application.decline_reason === APPLICATION_DECLINE_REASON_ROOM_FILLED;
}
