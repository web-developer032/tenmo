import 'server-only';
import { Bill, type UpdateBillInput } from '@/core/schemas/bills';
import { AllocationError, computeAllocations } from '@/core/utils/bill-allocations';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { resolveOccupiedRooms } from './room-occupancy';

/**
 * Update a bill. The reconciler runs whenever any of
 * `total_pence`, `allocation_method`, `period_start`, `period_end`,
 * or `shares` change; otherwise we just patch the metadata fields
 * and leave allocations untouched.
 */
export async function updateBill(
  ctx: HandlerContext,
  billId: string,
  input: UpdateBillInput,
): Promise<Bill> {
  requireUser(ctx);

  const { data: existing, error: lookupErr } = await ctx.supabase
    .from('bills')
    .select('*')
    .eq('id', billId)
    .maybeSingle();
  if (lookupErr) throw new DbError(lookupErr);
  if (!existing) throw new AppError(404, ErrorCode.not_found, 'Bill not found');

  const merged = {
    type: input.type ?? existing.type,
    provider: input.provider ?? existing.provider,
    reference: input.reference ?? existing.reference,
    total_pence: input.total_pence ?? existing.total_pence,
    period_start: input.period_start ?? existing.period_start,
    period_end: input.period_end ?? existing.period_end,
    allocation_method: input.allocation_method ?? existing.allocation_method,
    notes: input.notes ?? existing.notes,
  };

  const allocationsChanged =
    input.total_pence !== undefined ||
    input.allocation_method !== undefined ||
    input.period_start !== undefined ||
    input.period_end !== undefined ||
    input.shares !== undefined;

  if (allocationsChanged) {
    // Wipe the old allocations.
    const { error: delErr } = await ctx.supabase
      .from('bill_allocations')
      .delete()
      .eq('bill_id', billId);
    if (delErr) throw new DbError(delErr);

    if (merged.allocation_method === 'equal_per_room' || merged.allocation_method === 'by_share') {
      const occupied = await resolveOccupiedRooms(
        ctx,
        existing.property_id,
        merged.period_start,
        merged.period_end,
      );
      if (occupied.length === 0) {
        throw new AppError(
          422,
          ErrorCode.business_rule_violation,
          'No occupied rooms in the bill period — cannot recompute allocations.',
        );
      }

      const rooms = occupied.map((r) => ({
        room_id: r.room_id,
        tenancy_id: r.tenancy_id,
        share_basis_points:
          merged.allocation_method === 'by_share'
            ? (input.shares?.find((s) => s.room_id === r.room_id)?.share_basis_points ?? null)
            : null,
      }));

      let computed: ReturnType<typeof computeAllocations>;
      try {
        computed = computeAllocations({
          total_pence: merged.total_pence,
          method: merged.allocation_method,
          rooms,
        });
      } catch (err) {
        if (err instanceof AllocationError) {
          throw new AppError(422, ErrorCode.business_rule_violation, err.message);
        }
        throw err;
      }

      const insertRows = computed.map((a) => ({
        bill_id: billId,
        org_id: existing.org_id,
        room_id: a.room_id,
        tenancy_id: a.tenancy_id,
        amount_pence: a.amount_pence,
        share_basis_points: a.share_basis_points,
      }));
      const { error: insertErr } = await ctx.supabase.from('bill_allocations').insert(insertRows);
      if (insertErr) throw new DbError(insertErr);
    }
  }

  // Patch the bill row last so a failed allocation rebuild doesn't
  // leave inconsistent state.
  const { data: updated, error: updErr } = await ctx.supabase
    .from('bills')
    .update(merged)
    .eq('id', billId)
    .select('*')
    .single();
  if (updErr || !updated) throw new DbError(updErr ?? 'no row returned');

  // Verify the math.
  const { error: assertErr } = await ctx.supabase.rpc('assert_bill_allocations_balanced', {
    p_bill_id: billId,
  });
  if (assertErr) {
    throw new AppError(
      500,
      ErrorCode.internal_error,
      `Bill allocation balance check failed: ${assertErr.message}`,
    );
  }

  return Bill.parse(updated);
}
