import { z } from 'zod';
import {
  GOCARDLESS_MANDATE_STATUS_VALUES,
  type GoCardlessMandateStatus,
} from '../constants/payments';
import { uuid } from './common';

/**
 * Payment domain schemas — Direct-Debit mandates and the input bodies
 * for the payments API routes. The rent-side schemas
 * (`RentPayment`, `RentCharge`) live in `core/schemas/rent.ts`.
 */

export const GoCardlessMandateStatusEnum = z.enum(
  GOCARDLESS_MANDATE_STATUS_VALUES as [GoCardlessMandateStatus, ...GoCardlessMandateStatus[]],
);

export const GoCardlessMandate = z.object({
  id: uuid,
  org_id: uuid,
  tenancy_id: uuid,
  tenant_user_id: uuid.nullable(),
  gc_customer_id: z.string().nullable(),
  gc_mandate_id: z.string().nullable(),
  gc_redirect_flow_id: z.string().nullable(),
  gc_redirect_session_token: z.string().nullable(),
  status: GoCardlessMandateStatusEnum,
  flow_redirect_url: z.string().nullable(),
  created_by: uuid.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type GoCardlessMandate = z.infer<typeof GoCardlessMandate>;

/** Body for `POST /api/payments/mandates` — start the Redirect Flow. */
export const StartMandateInput = z.object({
  tenancy_id: uuid,
});

export type StartMandateInput = z.infer<typeof StartMandateInput>;

/** Body for `POST /api/payments/mandates/[id]/complete` — the callback
 * returns the redirect_flow_id from GoCardless as a query string. The
 * UI POSTs it back as part of the body so the server can complete the
 * flow + persist the mandate id. */
export const CompleteMandateInput = z.object({
  redirect_flow_id: z.string().min(1),
});

export type CompleteMandateInput = z.infer<typeof CompleteMandateInput>;

/** Body for `POST /api/payments/charges/[chargeId]/collect` — landlord
 * triggers a one-off DD pull for a specific charge (or the cron does
 * it under the hood with the same input). */
export const CollectChargeInput = z.object({
  /** Optional override for the amount in pence. Defaults to the
   * charge's outstanding balance — used when a tenant has already
   * partially paid. */
  amount_pence: z.number().int().positive().optional(),
  /** Optional charge_date (YYYY-MM-DD). GoCardless will pick the next
   * working day if omitted. */
  charge_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type CollectChargeInput = z.infer<typeof CollectChargeInput>;
