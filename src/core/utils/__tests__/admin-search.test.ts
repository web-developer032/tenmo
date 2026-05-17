import { describe, expect, it } from 'vitest';
import { buildIlikePattern, computePaginationRange, totalPages } from '../admin-search';

describe('computePaginationRange', () => {
  it('defaults to page 1 with the constant page size', () => {
    const r = computePaginationRange(undefined, undefined);
    expect(r.page).toBe(1);
    expect(r.perPage).toBe(25);
    expect(r.rangeStart).toBe(0);
    expect(r.rangeEnd).toBe(24);
  });

  it('clamps zero/negative page to 1', () => {
    expect(computePaginationRange(0, 10).page).toBe(1);
    expect(computePaginationRange(-5, 10).page).toBe(1);
  });

  it('clamps perPage to the documented maximum', () => {
    const r = computePaginationRange(1, 999_999);
    expect(r.perPage).toBe(100);
    expect(r.rangeEnd).toBe(99);
  });

  it('floors fractional values rather than rounding (avoids skipping rows)', () => {
    const r = computePaginationRange(2.9, 10.7);
    expect(r.page).toBe(2);
    expect(r.perPage).toBe(10);
    expect(r.rangeStart).toBe(10);
    expect(r.rangeEnd).toBe(19);
  });

  it('computes a contiguous range across pages', () => {
    const a = computePaginationRange(1, 25);
    const b = computePaginationRange(2, 25);
    expect(a.rangeEnd + 1).toBe(b.rangeStart);
  });
});

describe('buildIlikePattern', () => {
  it('returns null for empty / whitespace input', () => {
    expect(buildIlikePattern(null)).toBeNull();
    expect(buildIlikePattern(undefined)).toBeNull();
    expect(buildIlikePattern('')).toBeNull();
    expect(buildIlikePattern('   ')).toBeNull();
  });

  it('wraps trimmed input in % wildcards', () => {
    expect(buildIlikePattern('  Alice  ')).toBe('%Alice%');
  });

  it('escapes %, _, and \\ to prevent injection of LIKE wildcards', () => {
    expect(buildIlikePattern('100% off')).toBe('%100\\% off%');
    expect(buildIlikePattern('user_name')).toBe('%user\\_name%');
    expect(buildIlikePattern('back\\slash')).toBe('%back\\\\slash%');
  });
});

describe('totalPages', () => {
  it('returns at least 1 page even when there are zero rows', () => {
    expect(totalPages(0, 25)).toBe(1);
  });

  it('rounds up partial pages', () => {
    expect(totalPages(26, 25)).toBe(2);
    expect(totalPages(50, 25)).toBe(2);
    expect(totalPages(51, 25)).toBe(3);
  });

  it('returns 0 when perPage is invalid (avoids divide-by-zero)', () => {
    expect(totalPages(100, 0)).toBe(0);
    expect(totalPages(100, -1)).toBe(0);
  });
});
