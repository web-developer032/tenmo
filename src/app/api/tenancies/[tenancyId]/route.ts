import { Tenancy } from '@/core/schemas/tenancy';
import { DbError, NotFoundError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * GET /api/tenancies/[tenancyId] — single tenancy.
 *
 * RLS enforces visibility:
 *   - org members can read tenancies for their org
 *   - the assigned tenant can read their own
 *   - admins see all
 */
export const GET = handler<{ tenancyId: string }>(
  async (ctx, params) => {
    const { data, error } = await ctx.supabase
      .from('tenancies')
      .select('*')
      .eq('id', params.tenancyId)
      .maybeSingle();

    if (error) throw new DbError(error);
    if (!data) throw new NotFoundError('Tenancy not found');

    return Response.json({ data: Tenancy.parse(data) });
  },
  { requireAuth: true },
);
