import { z } from 'zod';
import { uuid } from './common';

/**
 * `public.expenses` row schemas.
 *
 * Source of truth is migration `20260524000000_landlord_ops_platform.sql`.
 * `amount_pence` is stored as integer pence; the UI converts to/from pounds.
 */

export const EXPENSE_CATEGORY_VALUES = [
  'repairs',
  'insurance',
  'mortgage',
  'utilities',
  'agent_fees',
  'compliance',
  'software',
  'travel',
  'professional_fees',
  'other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORY_VALUES)[number];

export const ExpenseCategoryEnum = z.enum(EXPENSE_CATEGORY_VALUES);

export const Expense = z.object({
  id: uuid,
  org_id: uuid,
  property_id: uuid.nullable(),
  occurred_on: z.string(),
  description: z.string().min(2).max(500),
  category: ExpenseCategoryEnum,
  amount_pence: z.number().int().nonnegative(),
  currency: z.string().default('GBP'),
  receipt_document_id: uuid.nullable(),
  mtd_eligible: z.boolean(),
  mtd_quarter: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Expense = z.infer<typeof Expense>;

export const CreateExpenseInput = z.object({
  property_id: uuid.optional().nullable(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  description: z.string().trim().min(2).max(500),
  category: ExpenseCategoryEnum,
  amount_pence: z.number().int().nonnegative().max(10_000_000),
  receipt_document_id: uuid.optional().nullable(),
  mtd_eligible: z.boolean().default(true),
  mtd_quarter: z
    .string()
    .regex(/^\d{4}Q[1-4]$/, 'Quarter must look like 2025Q3')
    .optional()
    .nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type CreateExpenseInput = z.infer<typeof CreateExpenseInput>;
