import { CreateEnvelopeInput } from '@/core/schemas/ast';
import { startAstEnvelope } from '@/features/ast/server';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { assertOrgMember, handler } from '@/lib/handler';

/**
 * POST /api/ast/envelopes — landlord starts an AST signing run.
 *
 * Body: `{ tenancy_id }`. Returns the freshly-created envelope row
 * (including DocuSeal IDs + sign URLs).
 *
 * AST is intentionally NOT tier-gated — every tenancy legally needs
 * an AST regardless of plan.
 */
export const POST = handler(
  async (ctx) => {
    const input = CreateEnvelopeInput.parse(await ctx.req.json());

    // Org membership: derive the org from the tenancy and assert
    // landlord-side membership before delegating.
    const { data: tenancy, error } = await ctx.supabase
      .from('tenancies')
      .select('id, org_id')
      .eq('id', input.tenancy_id)
      .maybeSingle();
    if (error) throw new DbError(error);
    if (!tenancy) throw new AppError(404, ErrorCode.not_found, 'Tenancy not found');

    await assertOrgMember(ctx, tenancy.org_id, ['owner', 'agent', 'staff']);

    const envelope = await startAstEnvelope(ctx, input.tenancy_id);
    return Response.json({ data: envelope });
  },
  { requireAuth: true },
);
