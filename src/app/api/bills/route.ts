import { CreateBillInput } from '@/core/schemas/bills';
import { createBill, listBillsForProperty } from '@/features/bills/server';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { assertOrgMember, handler } from '@/lib/handler';

/**
 * POST /api/bills — landlord creates a bill (with allocations).
 *
 * GET  /api/bills?property_id=... — list bills for a property
 *      (landlord only; RLS lets org members read).
 */

export const POST = handler(
  async (ctx) => {
    const input = CreateBillInput.parse(await ctx.req.json());

    // Derive org from property; assert landlord-side membership.
    const { data: property, error } = await ctx.supabase
      .from('properties')
      .select('id, org_id')
      .eq('id', input.property_id)
      .maybeSingle();
    if (error) throw new DbError(error);
    if (!property) throw new AppError(404, ErrorCode.not_found, 'Property not found');

    await assertOrgMember(ctx, property.org_id, ['owner', 'agent', 'staff']);

    const result = await createBill(ctx, property.org_id, input);
    return Response.json({ data: result }, { status: 201 });
  },
  { requireAuth: true },
);

export const GET = handler(
  async (ctx) => {
    const propertyId = ctx.req.nextUrl.searchParams.get('property_id');
    if (!propertyId) {
      throw new AppError(400, ErrorCode.bad_request, 'property_id query param is required');
    }
    const { data: property, error } = await ctx.supabase
      .from('properties')
      .select('id, org_id')
      .eq('id', propertyId)
      .maybeSingle();
    if (error) throw new DbError(error);
    if (!property) throw new AppError(404, ErrorCode.not_found, 'Property not found');
    await assertOrgMember(ctx, property.org_id);

    const bills = await listBillsForProperty(ctx, propertyId);
    return Response.json({ data: bills });
  },
  { requireAuth: true },
);
