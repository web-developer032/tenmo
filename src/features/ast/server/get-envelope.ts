import 'server-only';
import { AstEnvelope } from '@/core/schemas/ast';
import { DbError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Read the most-relevant AST envelope for a tenancy.
 *
 * Wraps the `active_envelope_for_tenancy(uuid)` RPC: returns the
 * single open envelope (sent|opened) if there is one, otherwise the
 * latest historical envelope. RLS scopes automatically — landlords
 * see all their org's envelopes; tenants see only their own.
 */
export async function getActiveEnvelopeForTenancy(
  ctx: HandlerContext,
  tenancyId: string,
): Promise<AstEnvelope | null> {
  requireUser(ctx);
  const { data, error } = await ctx.supabase.rpc('active_envelope_for_tenancy', {
    p_tenancy_id: tenancyId,
  });
  if (error) throw new DbError(error);
  const row = Array.isArray(data) ? data[0] : null;
  return row ? AstEnvelope.parse(row) : null;
}

/** Service-client variant for unauthenticated callers (webhook). */
export async function getEnvelopeBySubmissionIdService(
  submissionId: string,
): Promise<AstEnvelope | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('ast_envelopes')
    .select('*')
    .eq('docuseal_submission_id', submissionId)
    .maybeSingle();
  if (error) throw new DbError(error);
  return data ? AstEnvelope.parse(data) : null;
}

/** Service-client variant for unauthenticated callers (cron). */
export async function getEnvelopeByIdService(envelopeId: string): Promise<AstEnvelope | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('ast_envelopes')
    .select('*')
    .eq('id', envelopeId)
    .maybeSingle();
  if (error) throw new DbError(error);
  return data ? AstEnvelope.parse(data) : null;
}
