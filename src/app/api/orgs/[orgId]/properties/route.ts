import { Property, PropertyCreate, PropertyType } from '@/core/schemas/property';
import { assertTierAllows } from '@/features/billing/server';
import { DbError } from '@/lib/errors';
import { assertOrgMember, handler, requireUser } from '@/lib/handler';

/**
 * GET  /api/orgs/[orgId]/properties — list properties for an org.
 * POST /api/orgs/[orgId]/properties — create a property.
 *
 * Membership is enforced both by RLS and by `assertOrgMember` so we get
 * sharp 403/404 envelopes rather than silent empty arrays.
 */
export const GET = handler<{ orgId: string }>(
  async (ctx, params) => {
    await assertOrgMember(ctx, params.orgId);

    const { data, error } = await ctx.supabase
      .from('properties')
      .select('*')
      .eq('org_id', params.orgId)
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    if (error) throw new DbError(error);

    const list = (data ?? []).map((row) => Property.parse(row));
    return Response.json({ data: list });
  },
  { requireAuth: true },
);

export const POST = handler<{ orgId: string }>(
  async (ctx, params) => {
    await assertOrgMember(ctx, params.orgId, ['owner', 'agent']);
    await assertTierAllows(params.orgId, 'properties');
    const user = requireUser(ctx);

    const json = await ctx.req.json().catch(() => ({}));
    const input = PropertyCreate.parse(json);

    const isHmo = input.type === 'hmo_small' || input.type === 'hmo_large';
    const hmoLicenceRequired = input.type === 'hmo_large';

    const { data, error } = await ctx.supabase
      .from('properties')
      .insert({
        org_id: params.orgId,
        name: input.name,
        type: PropertyType.parse(input.type),
        address: input.address,
        notes: input.notes ?? null,
        is_hmo: isHmo,
        hmo_licence_required: hmoLicenceRequired,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error || !data) {
      ctx.log.error({ err: error }, 'failed to create property');
      throw new DbError(error ?? 'no row returned');
    }

    return Response.json({ data: Property.parse(data) }, { status: 201 });
  },
  { requireAuth: true },
);
