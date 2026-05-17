import { z } from 'zod';
import {
  PASSPORT_SECTION_VALUES,
  type PassportSection,
  type PaymentBand,
  type RtrDisplayStatus,
} from '../constants/passport';
import { uuid } from './common';

/**
 * Rental Passport schemas.
 *
 * The passport is an ASSEMBLED view — it joins identity, RTR
 * compliance, tenancy history and payment summaries into one
 * stable shape. The shape is the contract between the API
 * (`GET /api/passport`), the client preview, and the PDF renderer.
 */

export const PassportSectionEnum = z.enum(
  PASSPORT_SECTION_VALUES as [PassportSection, ...PassportSection[]],
);

export const PaymentBandEnum = z.enum([
  'excellent',
  'reliable',
  'mixed',
  'building',
  'no_record',
] as [PaymentBand, ...PaymentBand[]]);

export const RtrDisplayStatusEnum = z.enum(['verified', 'pending', 'expired', 'not_recorded'] as [
  RtrDisplayStatus,
  ...RtrDisplayStatus[],
]);

export const PassportIdentity = z.object({
  full_name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  member_since: z.string(),
});

export const PassportRtr = z.object({
  status: RtrDisplayStatusEnum,
  issued_at: z.string().nullable(),
  expires_at: z.string().nullable(),
});

export const PassportTenancyEntry = z.object({
  tenancy_id: uuid,
  property_name: z.string(),
  property_address: z.string(),
  room_name: z.string().nullable(),
  start_date: z.string(),
  end_date: z.string().nullable(),
  monthly_rent_pence: z.number().int().nonnegative().nullable(),
  status: z.string(),
});

export const PassportPaymentSummary = z.object({
  band: PaymentBandEnum,
  total_paid_pence: z.number().int().nonnegative(),
  paid_charges: z.number().int().nonnegative(),
  on_time_charges: z.number().int().nonnegative(),
  late_charges: z.number().int().nonnegative(),
  earliest_payment_date: z.string().nullable(),
  latest_payment_date: z.string().nullable(),
});

export const PassportDocumentEntry = z.object({
  kind: z.string(),
  title: z.string(),
  added_at: z.string(),
});

export const PassportData = z.object({
  generated_at: z.string(),
  identity: PassportIdentity,
  right_to_rent: PassportRtr,
  tenancies: z.array(PassportTenancyEntry),
  payments: PassportPaymentSummary,
  documents: z.array(PassportDocumentEntry),
});

export type PassportIdentity = z.infer<typeof PassportIdentity>;
export type PassportRtr = z.infer<typeof PassportRtr>;
export type PassportTenancyEntry = z.infer<typeof PassportTenancyEntry>;
export type PassportPaymentSummary = z.infer<typeof PassportPaymentSummary>;
export type PassportDocumentEntry = z.infer<typeof PassportDocumentEntry>;
export type PassportData = z.infer<typeof PassportData>;

/** Body for `POST /api/passport/pdf`. Empty by default — we generate
 * a passport with all known sections. The shape is here so the
 * future "section opt-in per share" feature is a backwards-compat
 * extension. */
export const GeneratePassportInput = z
  .object({
    sections: z.array(PassportSectionEnum).optional(),
  })
  .strict();

export type GeneratePassportInput = z.infer<typeof GeneratePassportInput>;
