import 'server-only';
import type { AllocationRoomInput } from '@/core/utils/bill-allocations';
import { DbError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Resolve the rooms eligible for an `equal_per_room` or `by_share`
 * allocation in the bill's period.
 *
 * "Eligible" = a room with an `active` tenancy that overlaps the
 * bill period at any point. Vacant rooms are excluded — see the
 * MVP rule in docs/07-flows/07-bills-splitting.md.
 *
 * Returns the rooms in deterministic order (by room id) so the
 * `computeAllocations` rounding remainder always lands in the same
 * place across re-runs.
 */
export interface OccupancyRoom extends AllocationRoomInput {
  room_name: string;
}

export async function resolveOccupiedRooms(
  ctx: HandlerContext,
  propertyId: string,
  periodStart: string,
  periodEnd: string,
): Promise<OccupancyRoom[]> {
  const { data: rooms, error } = await ctx.supabase
    .from('rooms')
    .select('id, name')
    .eq('property_id', propertyId)
    .is('archived_at', null)
    .order('id', { ascending: true });
  if (error) throw new DbError(error);

  const roomIds = (rooms ?? []).map((r) => r.id);
  if (roomIds.length === 0) return [];

  const { data: tenancies, error: tErr } = await ctx.supabase
    .from('tenancies')
    .select('id, room_id, status, start_date, end_date, tenant_user_id')
    .in('room_id', roomIds)
    .in('status', ['active', 'awaiting_deposit', 'awaiting_signature']);
  if (tErr) throw new DbError(tErr);

  const overlappingTenancyByRoom = new Map<string, { id: string; tenant_user_id: string | null }>();
  for (const t of tenancies ?? []) {
    if (!t.room_id) continue;
    if (!overlapsPeriod(t.start_date, t.end_date, periodStart, periodEnd)) continue;
    if (overlappingTenancyByRoom.has(t.room_id)) continue;
    overlappingTenancyByRoom.set(t.room_id, {
      id: t.id,
      tenant_user_id: t.tenant_user_id,
    });
  }

  const out: OccupancyRoom[] = [];
  for (const r of rooms ?? []) {
    const tenancy = overlappingTenancyByRoom.get(r.id);
    if (!tenancy) continue;
    out.push({ room_id: r.id, room_name: r.name, tenancy_id: tenancy.id });
  }
  return out;
}

function overlapsPeriod(
  startA: string,
  endA: string | null,
  startB: string,
  endB: string,
): boolean {
  // Open-ended end (periodic tenancy) treated as +inf.
  const aEnd = endA ?? '9999-12-31';
  return startA <= endB && aEnd >= startB;
}
