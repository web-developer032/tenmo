import { z } from 'zod';
import { AST_ENVELOPE_STATUS_VALUES, type AstEnvelopeStatus } from '../constants/ast';
import { uuid } from './common';

/**
 * AST envelope domain schemas. Mirrors `public.ast_envelopes`
 * (migration `20260101001900_ast_envelopes.sql`).
 */

export const AstEnvelopeStatusEnum = z.enum(
  AST_ENVELOPE_STATUS_VALUES as [AstEnvelopeStatus, ...AstEnvelopeStatus[]],
);

export const AstEnvelope = z.object({
  id: uuid,
  org_id: uuid,
  tenancy_id: uuid,
  status: AstEnvelopeStatusEnum,
  docuseal_submission_id: z.string().nullable(),
  docuseal_template_id: z.string().nullable(),
  landlord_sign_url: z.string().nullable(),
  tenant_sign_url: z.string().nullable(),
  document_path: z.string().nullable(),
  sent_at: z.string(),
  opened_at: z.string().nullable(),
  signed_at: z.string().nullable(),
  declined_at: z.string().nullable(),
  expired_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  decline_reason: z.string().nullable(),
  created_by: uuid,
  created_at: z.string(),
  updated_at: z.string(),
});

export type AstEnvelope = z.infer<typeof AstEnvelope>;

/** Body for `POST /api/ast/envelopes` — landlord creates the envelope.
 * `tenancy_id` is the only required input; we read all the fields we
 * need (rent, deposit, parties' names + emails) off the tenancy + the
 * profiles tables server-side. */
export const CreateEnvelopeInput = z.object({
  tenancy_id: uuid,
});

export type CreateEnvelopeInput = z.infer<typeof CreateEnvelopeInput>;
