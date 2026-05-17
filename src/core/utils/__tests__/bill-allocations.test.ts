import { describe, expect, it } from 'vitest';
import {
  AllocationError,
  allocateByShare,
  allocateEqual,
  computeAllocations,
  formatShareBasisPoints,
  sharesAreValid,
} from '../bill-allocations';

const room = (id: string, share?: number) => ({
  room_id: id,
  tenancy_id: `t-${id}`,
  share_basis_points: share,
});

describe('allocateEqual', () => {
  it('splits exactly when divisible', () => {
    const out = allocateEqual(12000, [room('a'), room('b'), room('c')]);
    expect(out.map((r) => r.amount_pence)).toEqual([4000, 4000, 4000]);
    expect(out.reduce((a, r) => a + r.amount_pence, 0)).toBe(12000);
  });

  it('puts the rounding remainder on the FIRST room (sorted by id)', () => {
    const out = allocateEqual(10000, [room('z'), room('a'), room('m')]);
    // sorted: a, m, z; base = 3333, remainder = 1
    expect(out[0]).toMatchObject({ room_id: 'a', amount_pence: 3334 });
    expect(out[1]).toMatchObject({ room_id: 'm', amount_pence: 3333 });
    expect(out[2]).toMatchObject({ room_id: 'z', amount_pence: 3333 });
    expect(out.reduce((a, r) => a + r.amount_pence, 0)).toBe(10000);
  });

  it('handles a single room', () => {
    const out = allocateEqual(7777, [room('only')]);
    expect(out[0]).toMatchObject({ room_id: 'only', amount_pence: 7777 });
  });

  it('handles zero total', () => {
    const out = allocateEqual(0, [room('a'), room('b')]);
    expect(out.map((r) => r.amount_pence)).toEqual([0, 0]);
  });

  it('throws when there are no rooms', () => {
    expect(() => allocateEqual(1000, [])).toThrow(AllocationError);
  });
});

describe('allocateByShare', () => {
  it('respects exact share percentages', () => {
    const out = allocateByShare(10000, [room('a', 5000), room('b', 5000)]);
    expect(out.map((r) => r.amount_pence)).toEqual([5000, 5000]);
  });

  it('puts the rounding remainder on the LARGEST share', () => {
    // a=60%, b=40%, total = 1001 → 600/400 = 1000; remainder 1 → goes to a (largest)
    const out = allocateByShare(1001, [room('a', 6000), room('b', 4000)]);
    expect(out.map((r) => r.amount_pence)).toEqual([601, 400]);
    expect(out.reduce((a, r) => a + r.amount_pence, 0)).toBe(1001);
  });

  it('uses stable tie-break (first largest wins)', () => {
    const out = allocateByShare(1001, [room('a', 5000), room('b', 5000)]);
    expect(out[0]?.amount_pence).toBe(501);
    expect(out[1]?.amount_pence).toBe(500);
  });

  it('throws when shares do not sum to 100%', () => {
    expect(() => allocateByShare(10000, [room('a', 5000), room('b', 4000)])).toThrow(
      /summing to 100%/,
    );
  });

  it('rejects empty rooms', () => {
    expect(() => allocateByShare(100, [])).toThrow(AllocationError);
  });
});

describe('computeAllocations', () => {
  it('returns no allocations for included_in_rent', () => {
    const out = computeAllocations({
      total_pence: 5000,
      method: 'included_in_rent',
      rooms: [room('a'), room('b')],
    });
    expect(out).toEqual([]);
  });

  it('returns no allocations for landlord_pays', () => {
    const out = computeAllocations({
      total_pence: 5000,
      method: 'landlord_pays',
      rooms: [room('a'), room('b')],
    });
    expect(out).toEqual([]);
  });

  it('routes to allocateEqual', () => {
    const out = computeAllocations({
      total_pence: 9999,
      method: 'equal_per_room',
      rooms: [room('a'), room('b'), room('c')],
    });
    expect(out.reduce((a, r) => a + r.amount_pence, 0)).toBe(9999);
  });

  it('throws on negative total', () => {
    expect(() =>
      computeAllocations({
        total_pence: -1,
        method: 'equal_per_room',
        rooms: [room('a')],
      }),
    ).toThrow(AllocationError);
  });

  it('throws on non-integer total', () => {
    expect(() =>
      computeAllocations({
        total_pence: 12.5,
        method: 'equal_per_room',
        rooms: [room('a')],
      }),
    ).toThrow(AllocationError);
  });
});

describe('sharesAreValid', () => {
  it('accepts shares summing to exactly 10000', () => {
    expect(sharesAreValid([{ share_basis_points: 5000 }, { share_basis_points: 5000 }])).toBe(true);
  });
  it('rejects under-100%', () => {
    expect(sharesAreValid([{ share_basis_points: 4000 }, { share_basis_points: 5000 }])).toBe(
      false,
    );
  });
  it('rejects over-100%', () => {
    expect(sharesAreValid([{ share_basis_points: 5500 }, { share_basis_points: 5000 }])).toBe(
      false,
    );
  });
});

describe('formatShareBasisPoints', () => {
  it('formats integer percentages cleanly', () => {
    expect(formatShareBasisPoints(5000)).toBe('50.00%');
  });
  it('formats fractional percentages', () => {
    expect(formatShareBasisPoints(3333)).toBe('33.33%');
  });
});
