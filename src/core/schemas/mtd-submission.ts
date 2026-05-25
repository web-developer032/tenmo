import { z } from 'zod';
import { uuid } from './common';

export const MTD_SUBMISSION_STATUS_VALUES = ['draft', 'generated', 'submitted'] as const;
export const MTD_SUBMISSION_METHOD_VALUES = ['csv_export', 'direct_api'] as const;

export type MtdSubmissionStatus = (typeof MTD_SUBMISSION_STATUS_VALUES)[number];
export type MtdSubmissionMethod = (typeof MTD_SUBMISSION_METHOD_VALUES)[number];

export const MtdSubmissionStatusEnum = z.enum(MTD_SUBMISSION_STATUS_VALUES);
export const MtdSubmissionMethodEnum = z.enum(MTD_SUBMISSION_METHOD_VALUES);

export const MtdSubmission = z.object({
  id: uuid,
  org_id: uuid,
  quarter: z.string().regex(/^\d{4}Q[1-4]$/),
  period_start: z.string(),
  period_end: z.string(),
  status: MtdSubmissionStatusEnum,
  income_pence: z.number().int().nonnegative(),
  expense_pence: z.number().int().nonnegative(),
  net_profit_pence: z.number().int(),
  submission_method: MtdSubmissionMethodEnum.nullable(),
  submission_ref: z.string().nullable(),
  submitted_at: z.string().nullable(),
  generated_csv_path: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type MtdSubmission = z.infer<typeof MtdSubmission>;

export const CreateMtdSubmissionInput = z.object({
  quarter: z.string().regex(/^\d{4}Q[1-4]$/, 'Quarter must look like 2025Q3'),
  submission_method: MtdSubmissionMethodEnum.default('csv_export'),
  submission_ref: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type CreateMtdSubmissionInput = z.infer<typeof CreateMtdSubmissionInput>;
