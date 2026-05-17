import { AstEnvelope } from '@/core/schemas/ast';
import { cancelAstEnvelope } from '@/features/ast/server';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { assertOrgMember, handler } from '@/lib/handler';

/**
 * GET  /api/ast/envelopes/[id] — fetch one envelope. Both landlord-
 *      side roles and the tenant on the tenancy can read (RLS).
 *
 * DELETE /api/ast/envelopes/[id] — cancel an open envelope. Landlord
 *      roles only; tenants who don't want to sign decline through
 *      DocuSeal directly.
 */

export const GET = handler<{ id: string }>(
  async (ctx, params) => {
    const { data, error } = await ctx.supabase
      .from('ast_envelopes')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    if (error) throw new DbError(error);
    if (!data) throw new AppError(404, ErrorCode.not_found, 'AST envelope not found');
    return Response.json({ data: AstEnvelope.parse(data) });
  },
  { requireAuth: true },
);

export const DELETE = handler<{ id: string }>(
  async (ctx, params) => {
    const { data: envelope, error } = await ctx.supabase
      .from('ast_envelopes')
      .select('id, org_id')
      .eq('id', params.id)
      .maybeSingle();
    if (error) throw new DbError(error);
    if (!envelope) throw new AppError(404, ErrorCode.not_found, 'AST envelope not found');

    await assertOrgMember(ctx, envelope.org_id, ['owner', 'agent', 'staff']);

    const updated = await cancelAstEnvelope(ctx, params.id);
    return Response.json({ data: updated });
  },
  { requireAuth: true },
);
