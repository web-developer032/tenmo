import { z } from 'zod';
import {
  BILL_ALLOCATION_METHOD_VALUES,
  BILL_TYPE_VALUES,
  type BillAllocationMethod,
  type BillType,
  SHARE_BASIS_POINTS_TOTAL,
} from '../constants/bills';
import { uuid } from './common';

/**
 * Bills domain schemas. Mirrors `public.bills` and
 * `public.bill_allocations` (migration `20260101002000_bills.sql`).
 */

export const BillTypeEnum = z.enum(BILL_TYPE_VALUES as [BillType, ...BillType[]]);
export const BillAllocationMethodEnum = z.enum(
  BILL_ALLOCATION_METHOD_VALUES as [BillAllocationMethod, ...BillAllocationMethod[]],
);

export const Bill = z.object({
  id: uuid,
  org_id: uuid,
  property_id: uuid,
  type: BillTypeEnum,
  provider: z.string().nullable(),
  reference: z.string().nullable(),
  total_pence: z.number().int().nonnegative(),
  currency: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  allocation_method: BillAllocationMethodEnum,
  document_path: z.string().nullable(),
  notes: z.string().nullable(),
  created_by: uuid,
  created_at: z.string(),
  updated_at: z.string(),
});

export type Bill = z.infer<typeof Bill>;

export const BillAllocation = z.object({
  id: uuid,
  bill_id: uuid,
  org_id: uuid,
  room_id: uuid,
  tenancy_id: uuid.nullable(),
  share_basis_points: z.number().int().min(0).max(SHARE_BASIS_POINTS_TOTAL).nullable(),
  amount_pence: z.number().int().nonnegative(),
  created_at: z.string(),
});

export type BillAllocation = z.infer<typeof BillAllocation>;

/** Per-room share input for `by_share`. Basis points (0..10000). */
export const BillShareInput = z.object({
  room_id: uuid,
  share_basis_points: z.number().int().min(0).max(SHARE_BASIS_POINTS_TOTAL),
});

export type BillShareInput = z.infer<typeof BillShareInput>;

/** Body for `POST /api/bills`. The `shares` array is required and
 * validated against `allocation_method` server-side:
 *   - equal_per_room → ignored
 *   - by_share       → required, must sum to exactly 10000
 *   - included_in_rent / landlord_pays → ignored */
export const CreateBillInput = z
  .object({
    property_id: uuid,
    type: BillTypeEnum,
    provider: z.string().trim().max(120).optional(),
    reference: z.string().trim().max(80).optional(),
    total_pence: z.number().int().nonnegative(),
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected ISO date'),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected ISO date'),
    allocation_method: BillAllocationMethodEnum,
    shares: z.array(BillShareInput).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.period_end >= v.period_start, {
    message: 'period_end must be on or after period_start',
    path: ['period_end'],
  })
  .refine((v) => v.allocation_method !== 'by_share' || (v.shares && v.shares.length > 0), {
    message: 'shares is required for by_share allocations',
    path: ['shares'],
  });

export type CreateBillInput = z.infer<typeof CreateBillInput>;

/** Body for `PATCH /api/bills/[id]`. Allows editing every mutable
 * field; the server recomputes allocations whenever `total_pence`,
 * `allocation_method`, or `shares` change. */
export const UpdateBillInput = z
  .object({
    type: BillTypeEnum.optional(),
    provider: z.string().trim().max(120).nullish(),
    reference: z.string().trim().max(80).nullish(),
    total_pence: z.number().int().nonnegative().optional(),
    period_start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    period_end: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    allocation_method: BillAllocationMethodEnum.optional(),
    shares: z.array(BillShareInput).optional(),
    notes: z.string().trim().max(1000).nullish(),
  })
  .refine((v) => !(v.period_start && v.period_end) || v.period_end >= v.period_start, {
    message: 'period_end must be on or after period_start',
    path: ['period_end'],
  });

export type UpdateBillInput = z.infer<typeof UpdateBillInput>;
