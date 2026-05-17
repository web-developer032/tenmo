import type { BillAllocationMethod } from '../constants/bills';
import { SHARE_BASIS_POINTS_TOTAL } from '../constants/bills';

/**
 * Pure allocation math for bills splitting.
 *
 * Three guarantees:
 *   1. **No penny lost** — sum of computed amounts MUST equal the
 *      bill total exactly (unless the method has no allocations).
 *   2. **Deterministic** — the same inputs in the same order always
 *      yield the same outputs. Callers sort rooms by id beforehand
 *      to keep the rounding remainder going to a stable room.
 *   3. **Pure** — no side effects, no React, no Supabase. Trivially
 *      unit-testable; portable to Expo.
 *
 * Allocation methods (see docs/07-flows/07-bills-splitting.md):
 *   - `equal_per_room`     → total ÷ N, remainder added to the
 *                            first room.
 *   - `by_share`           → floor(total · share / 10000) per room,
 *                            remainder added to the room with the
 *                            largest share.
 *   - `included_in_rent`   → empty result (no allocations).
 *   - `landlord_pays`      → empty result (no allocations).
 */

export interface AllocationRoomInput {
  room_id: string;
  /** Optional active tenancy id at the time of allocation. Stamped
   * onto the row so a later mover-out still sees their bill. */
  tenancy_id?: string | null;
  /** Required for `by_share`. 0..10000 (basis points). */
  share_basis_points?: number | null;
}

export interface AllocationResultRow {
  room_id: string;
  tenancy_id: string | null;
  share_basis_points: number | null;
  amount_pence: number;
}

export interface AllocationInputs {
  total_pence: number;
  method: BillAllocationMethod;
  rooms: AllocationRoomInput[];
}

export class AllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AllocationError';
  }
}

export function computeAllocations(input: AllocationInputs): AllocationResultRow[] {
  if (!Number.isInteger(input.total_pence) || input.total_pence < 0) {
    throw new AllocationError('total_pence must be a non-negative integer');
  }

  switch (input.method) {
    case 'included_in_rent':
    case 'landlord_pays':
      return [];

    case 'equal_per_room':
      return allocateEqual(input.total_pence, input.rooms);

    case 'by_share':
      return allocateByShare(input.total_pence, input.rooms);

    default: {
      const exhaustive: never = input.method;
      throw new AllocationError(`Unknown allocation method: ${String(exhaustive)}`);
    }
  }
}

export function allocateEqual(
  totalPence: number,
  rooms: AllocationRoomInput[],
): AllocationResultRow[] {
  if (rooms.length === 0) {
    throw new AllocationError(
      'equal_per_room needs at least one room — no occupied rooms in the bill period',
    );
  }
  const sorted = [...rooms].sort((a, b) => a.room_id.localeCompare(b.room_id));
  const base = Math.floor(totalPence / sorted.length);
  const remainder = totalPence - base * sorted.length;
  return sorted.map((room, idx) => ({
    room_id: room.room_id,
    tenancy_id: room.tenancy_id ?? null,
    share_basis_points: null,
    amount_pence: base + (idx === 0 ? remainder : 0),
  }));
}

export function allocateByShare(
  totalPence: number,
  rooms: AllocationRoomInput[],
): AllocationResultRow[] {
  if (rooms.length === 0) {
    throw new AllocationError('by_share needs at least one room');
  }

  const sorted = [...rooms].sort((a, b) => a.room_id.localeCompare(b.room_id));
  const sumBp = sorted.reduce((acc, r) => acc + (r.share_basis_points ?? 0), 0);
  if (sumBp !== SHARE_BASIS_POINTS_TOTAL) {
    throw new AllocationError(`by_share requires shares summing to 100% (got ${sumBp / 100}%)`);
  }

  const allocations = sorted.map((room) => {
    const bp = room.share_basis_points ?? 0;
    const amount = Math.floor((totalPence * bp) / SHARE_BASIS_POINTS_TOTAL);
    return {
      room_id: room.room_id,
      tenancy_id: room.tenancy_id ?? null,
      share_basis_points: bp,
      amount_pence: amount,
    };
  });

  const allocated = allocations.reduce((acc, a) => acc + a.amount_pence, 0);
  const remainder = totalPence - allocated;
  if (remainder > 0) {
    // Find the row with the largest share (stable: first largest
    // wins if there are ties).
    let target = 0;
    for (let i = 1; i < allocations.length; i++) {
      const current = allocations[i];
      const winner = allocations[target];
      if (
        current &&
        winner &&
        (current.share_basis_points ?? 0) > (winner.share_basis_points ?? 0)
      ) {
        target = i;
      }
    }
    const targetRow = allocations[target];
    if (targetRow) {
      targetRow.amount_pence += remainder;
    }
  }

  return allocations;
}

/** True when `shares` (basis points) sum to exactly 100%. */
export function sharesAreValid(shares: ReadonlyArray<{ share_basis_points: number }>): boolean {
  return shares.reduce((acc, s) => acc + s.share_basis_points, 0) === SHARE_BASIS_POINTS_TOTAL;
}

/** Format a basis-points share for display: "33.33%". */
export function formatShareBasisPoints(bp: number): string {
  return `${(bp / 100).toFixed(2)}%`;
}
