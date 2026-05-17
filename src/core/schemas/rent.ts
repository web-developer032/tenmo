import { z } from 'zod';
import { dateIso, pence, uuid } from './common';

/**
 * Rent ledger schemas.
 *
 * These mirror `rent_charges` and `rent_payments` in the database (see
 * migration `20260101000900_rent_ledger.sql`). All money is stored in
 * integer pence; client UI converts to pounds at the edges only.
 */

export const RentChargeStatus = z.enum([
  'upcoming',
  'due',
  'paid',
  'partially_paid',
  'overdue',
  'waived',
  'cancelled',
]);
export type RentChargeStatus = z.infer<typeof RentChargeStatus>;

export const RentPaymentMethod = z.enum([
  'manual_bank_transfer',
  'manual_cash',
  'manual_card',
  'manual_other',
  'gocardless_dd',
  'truelayer_ob',
]);
export type RentPaymentMethod = z.infer<typeof RentPaymentMethod>;

export const RentPaymentStatus = z.enum([
  'pending',
  'confirmed',
  'failed',
  'charged_back',
  'refunded',
]);
export type RentPaymentStatus = z.infer<typeof RentPaymentStatus>;

export const RentCharge = z.object({
  id: uuid,
  org_id: uuid,
  tenancy_id: uuid,
  period_start: dateIso,
  period_end: dateIso,
  due_date: dateIso,
  amount_pence: pence,
  currency: z.string().default('GBP'),
  paid_pence: pence,
  status: RentChargeStatus,
  notes: z.string().nullable(),
  external_charge_id: z.string().nullable(),
  created_by: uuid.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type RentCharge = z.infer<typeof RentCharge>;

export const RentPayment = z.object({
  id: uuid,
  org_id: uuid,
  tenancy_id: uuid,
  charge_id: uuid.nullable(),
  amount_pence: pence,
  currency: z.string().default('GBP'),
  method: RentPaymentMethod,
  status: RentPaymentStatus,
  external_id: z.string().nullable(),
  paid_at: z.string().nullable(),
  notes: z.string().nullable(),
  recorded_by: uuid.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type RentPayment = z.infer<typeof RentPayment>;

/**
 * Manual payment recorded by a landlord. We deliberately keep the surface
 * small — a landlord noting "tenant paid £550 on the 5th" — and let the
 * server allocate it FIFO across open charges if `charge_id` is omitted.
 */
export const ManualPaymentInput = z.object({
  amount_pence: z.number().int().positive(),
  method: z.enum(['manual_bank_transfer', 'manual_cash', 'manual_card', 'manual_other']),
  paid_at: z.string().datetime().optional(),
  paid_on: dateIso.optional(),
  charge_id: uuid.optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});
export type ManualPaymentInput = z.infer<typeof ManualPaymentInput>;

/** Filter input for listing charges. */
export const RentChargeListFilter = z.object({
  tenancy_id: uuid.optional(),
  status: RentChargeStatus.optional(),
  from: dateIso.optional(),
  to: dateIso.optional(),
});
export type RentChargeListFilter = z.infer<typeof RentChargeListFilter>;

/** Aggregated arrears row from the `tenancy_arrears` view. */
export const TenancyArrears = z.object({
  tenancy_id: uuid,
  org_id: uuid,
  arrears_pence: z.number().int(),
  overdue_count: z.number().int().min(0).nullable(),
  next_due_date: dateIso.nullable(),
});
export type TenancyArrears = z.infer<typeof TenancyArrears>;
