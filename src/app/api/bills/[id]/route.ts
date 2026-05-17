import { UpdateBillInput } from '@/core/schemas/bills';
import { deleteBill, getBill, updateBill } from '@/features/bills/server';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { assertOrgMember, handler } from '@/lib/handler';

/**
 * GET    /api/bills/[id] — fetch one bill + its allocations.
 * PATCH  /api/bills/[id] — update a bill; recomputes allocations
 *        when total/method/period/shares change.
 * DELETE /api/bills/[id] — delete the bill (cascades to allocations).
 *
 * All landlord-side; tenants don't write bills.
 */

export const GET = handler<{ id: string }>(
  async (ctx, params) => {
    const result = await getBill(ctx, params.id);
    return Response.json({ data: result });
  },
  { requireAuth: true },
);

export const PATCH = handler<{ id: string }>(
  async (ctx, params) => {
    const input = UpdateBillInput.parse(await ctx.req.json());

    const { data: existing, error } = await ctx.supabase
      .from('bills')
      .select('id, org_id')
      .eq('id', params.id)
      .maybeSingle();
    if (error) throw new DbError(error);
    if (!existing) throw new AppError(404, ErrorCode.not_found, 'Bill not found');

    await assertOrgMember(ctx, existing.org_id, ['owner', 'agent', 'staff']);

    const bill = await updateBill(ctx, params.id, input);
    return Response.json({ data: bill });
  },
  { requireAuth: true },
);

export const DELETE = handler<{ id: string }>(
  async (ctx, params) => {
    const { data: existing, error } = await ctx.supabase
      .from('bills')
      .select('id, org_id')
      .eq('id', params.id)
      .maybeSingle();
    if (error) throw new DbError(error);
    if (!existing) throw new AppError(404, ErrorCode.not_found, 'Bill not found');

    await assertOrgMember(ctx, existing.org_id, ['owner', 'agent', 'staff']);

    await deleteBill(ctx, params.id);
    return Response.json({ data: { id: params.id, deleted: true } });
  },
  { requireAuth: true },
);
