import { Room, RoomCreate, RoomFurnishing } from '@/core/schemas/room';
import { assertTierAllows } from '@/features/billing/server';
import { DbError, NotFoundError } from '@/lib/errors';
import { assertOrgMember, type HandlerContext, handler, requireUser } from '@/lib/handler';

/**
 * GET  /api/properties/[propertyId]/rooms — list rooms of a property.
 * POST /api/properties/[propertyId]/rooms — create a room (owner/agent only).
 *
 * The property is looked up first to derive `org_id` for the membership check;
 * RLS would also reject this, but explicit checks give us nicer error envelopes.
 */
export const GET = handler<{ propertyId: string }>(
  async (ctx, params) => {
    const property = await loadProperty(ctx, params.propertyId);
    await assertOrgMember(ctx, property.org_id);

    const { data, error } = await ctx.supabase
      .from('rooms')
      .select('*')
      .eq('property_id', property.id)
      .is('archived_at', null)
      .order('name');

    if (error) throw new DbError(error);
    const list = (data ?? []).map((row) => Room.parse(row));
    return Response.json({ data: list });
  },
  { requireAuth: true },
);

export const POST = handler<{ propertyId: string }>(
  async (ctx, params) => {
    const property = await loadProperty(ctx, params.propertyId);
    await assertOrgMember(ctx, property.org_id, ['owner', 'agent']);
    await assertTierAllows(property.org_id, 'rooms');
    const user = requireUser(ctx);

    const json = await ctx.req.json().catch(() => ({}));
    const input = RoomCreate.parse(json);

    const { data, error } = await ctx.supabase
      .from('rooms')
      .insert({
        org_id: property.org_id,
        property_id: property.id,
        name: input.name,
        description: input.description ?? null,
        size_sqm: input.size_sqm ?? null,
        has_ensuite: input.has_ensuite,
        has_double_bed: input.has_double_bed,
        furnishing: RoomFurnishing.parse(input.furnishing),
        default_rent_pence: input.default_rent_pence ?? null,
        default_rent_frequency: input.default_rent_frequency,
        bills_included: input.bills_included,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error || !data) {
      ctx.log.error({ err: error }, 'failed to create room');
      throw new DbError(error ?? 'no row returned');
    }

    return Response.json({ data: Room.parse(data) }, { status: 201 });
  },
  { requireAuth: true },
);

async function loadProperty(ctx: HandlerContext, propertyId: string) {
  const { data, error } = await ctx.supabase
    .from('properties')
    .select('id, org_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (error) throw new DbError(error);
  if (!data) throw new NotFoundError('Property not found');
  return data as { id: string; org_id: string };
}
