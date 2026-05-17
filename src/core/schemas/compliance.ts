import { z } from 'zod';
import { COMPLIANCE_TYPE_VALUES, type ComplianceType } from '../constants/compliance';
import { dateIso, uuid } from './common';

/**
 * Compliance — certificates, licences, and risk assessments tracked per
 * property/room/tenancy. Status is server-generated, so the schema mirrors
 * `compliance_items.status` rather than computing it client-side.
 */

const COMPLIANCE_TYPE_TUPLE = COMPLIANCE_TYPE_VALUES as [ComplianceType, ...ComplianceType[]];

export const ComplianceTypeSchema = z.enum(COMPLIANCE_TYPE_TUPLE);

export const ComplianceStatusSchema = z.enum(['ok', 'due_soon', 'overdue', 'unknown']);
export type ComplianceStatusValue = z.infer<typeof ComplianceStatusSchema>;

export const ComplianceItem = z.object({
  id: uuid,
  org_id: uuid,
  property_id: uuid.nullable(),
  room_id: uuid.nullable(),
  tenancy_id: uuid.nullable(),
  type: ComplianceTypeSchema,
  issued_at: dateIso.nullable(),
  expires_at: dateIso.nullable(),
  document_path: z.string().nullable(),
  notes: z.string().nullable(),
  status: ComplianceStatusSchema,
  created_by: uuid,
  created_at: z.string(),
  updated_at: z.string(),
});
export type ComplianceItem = z.infer<typeof ComplianceItem>;

/**
 * Form schema for adding a new compliance item.
 *
 * - At least one scope (property/room/tenancy) must be supplied — enforced
 *   server-side by a CHECK constraint and re-validated here for friendlier
 *   form errors.
 * - `expires_at` may be omitted; the server can derive it from
 *   `validityMonths` if the type has a fixed validity period.
 */
export const ComplianceItemCreate = z
  .object({
    type: ComplianceTypeSchema,
    property_id: uuid.optional().nullable(),
    room_id: uuid.optional().nullable(),
    tenancy_id: uuid.optional().nullable(),
    issued_at: dateIso.optional().nullable(),
    expires_at: dateIso.optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((v) => v.property_id || v.room_id || v.tenancy_id, {
    message: 'Pick a property, room, or tenancy.',
    path: ['property_id'],
  });
export type ComplianceItemCreate = z.infer<typeof ComplianceItemCreate>;

export const ComplianceItemUpdate = z
  .object({
    issued_at: dateIso.optional().nullable(),
    expires_at: dateIso.optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    document_path: z.string().optional().nullable(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'No changes provided.',
  });
export type ComplianceItemUpdate = z.infer<typeof ComplianceItemUpdate>;

/** Filter input for the listing endpoint. */
export const ComplianceListFilter = z.object({
  property_id: uuid.optional(),
  status: ComplianceStatusSchema.optional(),
  type: ComplianceTypeSchema.optional(),
});
export type ComplianceListFilter = z.infer<typeof ComplianceListFilter>;
