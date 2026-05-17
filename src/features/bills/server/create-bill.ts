import 'server-only';
import { Bill, type CreateBillInput } from '@/core/schemas/bills';
import { AllocationError, computeAllocations } from '@/core/utils/bill-allocations';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { notifyTenantsOfBill } from './notify-bill';
import { resolveOccupiedRooms } from './room-occupancy';

/**
 * Landlord creates a new bill.
 *
 * Steps:
 *   1. Verify property exists in caller's org.
 *   2. For `equal_per_room` / `by_share`, resolve the eligible
 *      rooms (rooms with active tenancies overlapping the bill
 *      period) and compute per-room amounts using the pure
 *      `computeAllocations` helper.
 *   3. Insert the `bills` row.
 *   4. Insert the `bill_allocations` rows.
 *   5. Run `assert_bill_allocations_balanced` to defence-in-depth
 *      verify the math (so a buggy refactor can never silently
 *      lose pennies).
 *   6. Fire best-effort tenant notifications.
 *
 * Returns the inserted bill row + the computed allocation rows so
 * the UI can render the result without a follow-up GET.
 */
export interface CreateBillResult {
  bill: Bill;
  allocations: Array<{
    id: string;
    room_id: string;
    tenancy_id: string | null;
    amount_pence: number;
    share_basis_points: number | null;
  }>;
}

export async function createBill(
  ctx: HandlerContext,
  orgId: string,
  input: CreateBillInput,
): Promise<CreateBillResult> {
  const user = requireUser(ctx);

  const { data: property, error: propErr } = await ctx.supabase
    .from('properties')
    .select('id, org_id')
    .eq('id', input.property_id)
    .eq('org_id', orgId)
    .maybeSingle();
  if (propErr) throw new DbError(propErr);
  if (!property) throw new AppError(404, ErrorCode.not_found, 'Property not found');

  let allocationsToInsert: Array<{
    room_id: string;
    tenancy_id: string | null;
    amount_pence: number;
    share_basis_points: number | null;
  }> = [];

  if (input.allocation_method === 'equal_per_room' || input.allocation_method === 'by_share') {
    const occupied = await resolveOccupiedRooms(
      ctx,
      input.property_id,
      input.period_start,
      input.period_end,
    );
    if (occupied.length === 0) {
      throw new AppError(
        422,
        ErrorCode.business_rule_violation,
        'No occupied rooms in the bill period — there is no one to allocate this bill to.',
      );
    }

    if (input.allocation_method === 'by_share') {
      // Validate: every input share must reference an occupied room
      // and shares must cover exactly the occupied set.
      const occupiedIds = new Set(occupied.map((r) => r.room_id));
      const shares = input.shares ?? [];
      const sharesByRoom = new Map(shares.map((s) => [s.room_id, s.share_basis_points]));
      for (const s of shares) {
        if (!occupiedIds.has(s.room_id)) {
          throw new AppError(
            422,
            ErrorCode.business_rule_violation,
            `Room ${s.room_id} is not occupied during the bill period`,
          );
        }
      }
      for (const occupiedRoom of occupied) {
        if (!sharesByRoom.has(occupiedRoom.room_id)) {
          throw new AppError(
            422,
            ErrorCode.business_rule_violation,
            `Missing share for occupied room ${occupiedRoom.room_id}`,
          );
        }
      }
    }

    const roomsForCalc = occupied.map((r) => ({
      room_id: r.room_id,
      tenancy_id: r.tenancy_id,
      share_basis_points:
        input.allocation_method === 'by_share'
          ? (input.shares?.find((s) => s.room_id === r.room_id)?.share_basis_points ?? null)
          : null,
    }));

    let computed: ReturnType<typeof computeAllocations>;
    try {
      computed = computeAllocations({
        total_pence: input.total_pence,
        method: input.allocation_method,
        rooms: roomsForCalc,
      });
    } catch (err) {
      if (err instanceof AllocationError) {
        throw new AppError(422, ErrorCode.business_rule_violation, err.message);
      }
      throw err;
    }

    allocationsToInsert = computed.map((a) => ({
      room_id: a.room_id,
      tenancy_id: a.tenancy_id,
      amount_pence: a.amount_pence,
      share_basis_points: a.share_basis_points,
    }));
  }

  const { data: billRow, error: insertErr } = await ctx.supabase
    .from('bills')
    .insert({
      org_id: orgId,
      property_id: input.property_id,
      type: input.type,
      provider: input.provider ?? null,
      reference: input.reference ?? null,
      total_pence: input.total_pence,
      period_start: input.period_start,
      period_end: input.period_end,
      allocation_method: input.allocation_method,
      notes: input.notes ?? null,
      created_by: user.id,
    })
    .select('*')
    .single();
  if (insertErr || !billRow) throw new DbError(insertErr ?? 'no row returned');

  const billId = billRow.id;

  const insertedAllocations: CreateBillResult['allocations'] = [];
  if (allocationsToInsert.length > 0) {
    const rows = allocationsToInsert.map((a) => ({
      bill_id: billId,
      org_id: orgId,
      room_id: a.room_id,
      tenancy_id: a.tenancy_id,
      amount_pence: a.amount_pence,
      share_basis_points: a.share_basis_points,
    }));
    const { data: allocRows, error: allocErr } = await ctx.supabase
      .from('bill_allocations')
      .insert(rows)
      .select('id, room_id, tenancy_id, amount_pence, share_basis_points');
    if (allocErr || !allocRows) {
      // Best effort cleanup so we don't leave a half-allocated bill behind.
      await ctx.supabase.from('bills').delete().eq('id', billId);
      throw new DbError(allocErr ?? 'allocation insert returned no rows');
    }
    for (const row of allocRows) {
      insertedAllocations.push(row);
    }
  }

  // Defence-in-depth: ask the DB to verify the math.
  const { error: assertErr } = await ctx.supabase.rpc('assert_bill_allocations_balanced', {
    p_bill_id: billId,
  });
  if (assertErr) {
    await ctx.supabase.from('bills').delete().eq('id', billId);
    throw new AppError(
      500,
      ErrorCode.internal_error,
      `Bill allocation balance check failed: ${assertErr.message}`,
    );
  }

  const parsed = Bill.parse(billRow);

  // Best-effort notification fan-out (non-blocking).
  if (insertedAllocations.length > 0) {
    const tenantIds = await loadTenantIdsForAllocations(
      ctx,
      insertedAllocations.map((a) => a.tenancy_id).filter((id): id is string => !!id),
    );
    const recipientByUser = new Map<string, number>();
    for (const a of insertedAllocations) {
      const userId = a.tenancy_id ? tenantIds.get(a.tenancy_id) : null;
      if (!userId) continue;
      recipientByUser.set(userId, (recipientByUser.get(userId) ?? 0) + a.amount_pence);
    }
    await notifyTenantsOfBill({
      bill_id: billId,
      bill_type: parsed.type,
      property_id: input.property_id,
      recipients: Array.from(recipientByUser.entries()).map(([user_id, amount_pence]) => ({
        user_id,
        amount_pence,
      })),
    });
  }

  return { bill: parsed, allocations: insertedAllocations };
}

async function loadTenantIdsForAllocations(
  ctx: HandlerContext,
  tenancyIds: string[],
): Promise<Map<string, string>> {
  if (tenancyIds.length === 0) return new Map();
  const { data, error } = await ctx.supabase
    .from('tenancies')
    .select('id, tenant_user_id')
    .in('id', tenancyIds);
  if (error) throw new DbError(error);
  const out = new Map<string, string>();
  for (const t of data ?? []) {
    if (t.tenant_user_id) out.set(t.id, t.tenant_user_id);
  }
  return out;
}
