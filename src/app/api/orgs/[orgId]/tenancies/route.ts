import { Tenancy, TenancyInvite } from '@/core/schemas/tenancy';
import { assertTierAllows } from '@/features/billing/server';
import { createTenancyInvite } from '@/features/tenancies/server';
import { DbError } from '@/lib/errors';
import { assertOrgMember, handler, requireUser } from '@/lib/handler';

/**
 * GET  /api/orgs/[orgId]/tenancies — list tenancies for an org (members only).
 * POST /api/orgs/[orgId]/tenancies — landlord creates a pending invite.
 *
 * The created tenancy carries a system-generated `invite_token` (DB trigger).
 * The handler returns the tenancy + a public invite URL the landlord can copy.
 */
export const GET = handler<{ orgId: string }>(
  async (ctx, params) => {
    await assertOrgMember(ctx, params.orgId);

    const url = new URL(ctx.req.url);
    const status = url.searchParams.get('status');

    let query = ctx.supabase
      .from('tenancies')
      .select('*')
      .eq('org_id', params.orgId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new DbError(error);

    const list = (data ?? []).map((row) => Tenancy.parse(row));
    return Response.json({ data: list });
  },
  { requireAuth: true },
);

export const POST = handler<{ orgId: string }>(
  async (ctx, params) => {
    await assertOrgMember(ctx, params.orgId, ['owner', 'agent']);
    await assertTierAllows(params.orgId, 'tenancies');
    const user = requireUser(ctx);

    const json = await ctx.req.json().catch(() => ({}));
    const input = TenancyInvite.parse(json);

    const result = await createTenancyInvite(ctx, params.orgId, input, user);
    return Response.json({ data: result }, { status: 201 });
  },
  { requireAuth: true },
);
