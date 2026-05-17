import 'server-only';
import { AstEnvelope } from '@/core/schemas/ast';
import { canCancelEnvelope } from '@/core/utils/ast-rules';
import { cancelSubmission as dsCancelSubmission } from '@/lib/docuseal/client';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { getLogger } from '@/lib/logger';

/**
 * Cancel an in-flight AST envelope.
 *
 * Landlord-side only (tenants who don't want to sign use "Decline" in
 * the DocuSeal hosted form). Calls DocuSeal first; on success we mark
 * the local row `cancelled`. If DocuSeal returns 404 or the envelope
 * was already cancelled we still update locally — the webhook
 * reconciler is the long-term source of truth either way.
 */
export async function cancelAstEnvelope(
  ctx: HandlerContext,
  envelopeId: string,
): Promise<AstEnvelope> {
  const user = requireUser(ctx);
  const log = getLogger().child({ module: 'ast.cancel', envelopeId, userId: user.id });

  const { data: envelope, error: lookupErr } = await ctx.supabase
    .from('ast_envelopes')
    .select('id, org_id, status, docuseal_submission_id')
    .eq('id', envelopeId)
    .maybeSingle();
  if (lookupErr) throw new DbError(lookupErr);
  if (!envelope) throw new AppError(404, ErrorCode.not_found, 'AST envelope not found');

  if (!canCancelEnvelope(envelope.status)) {
    throw new AppError(
      422,
      ErrorCode.business_rule_violation,
      `Cannot cancel an envelope in state '${envelope.status}'.`,
    );
  }

  if (envelope.docuseal_submission_id) {
    try {
      await dsCancelSubmission(envelope.docuseal_submission_id);
    } catch (err) {
      // 404 / already-cancelled at DocuSeal → proceed to local update.
      if (err instanceof AppError && (err.status === 404 || err.status === 422)) {
        log.warn({ err: err.message }, 'docuseal cancel returned soft error; continuing');
      } else {
        throw err;
      }
    }
  }

  const { data: updated, error: updErr } = await ctx.supabase
    .from('ast_envelopes')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', envelope.id)
    .select('*')
    .single();
  if (updErr || !updated) throw new DbError(updErr ?? 'no row returned');

  return AstEnvelope.parse(updated);
}
