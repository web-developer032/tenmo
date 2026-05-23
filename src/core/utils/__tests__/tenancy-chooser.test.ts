import { describe, expect, it } from 'vitest';
import {
  CHOOSABLE_TENANCY_STATUSES,
  type ChoosableTenancy,
  chooseTenancyTarget,
} from '@/core/utils/tenancy-chooser';

const t = (id: string, start_date: string, status: string = 'active'): ChoosableTenancy => ({
  id,
  status,
  start_date,
});

describe('chooseTenancyTarget', () => {
  it('returns empty when the tenant has no tenancies', () => {
    expect(chooseTenancyTarget([])).toEqual({ kind: 'empty' });
  });

  it('returns the single tenancy id when there is exactly one', () => {
    expect(chooseTenancyTarget([t('aaa', '2026-01-01')])).toEqual({
      kind: 'one',
      targetId: 'aaa',
    });
  });

  it('returns the picker list sorted by most-recent start_date when there are multiple', () => {
    const result = chooseTenancyTarget([
      t('older', '2024-01-01'),
      t('newest', '2026-05-01'),
      t('middle', '2025-09-01'),
    ]);
    expect(result.kind).toBe('multi');
    if (result.kind !== 'multi') return;
    expect(result.tenancies.map((x) => x.id)).toEqual(['newest', 'middle', 'older']);
  });

  it('does not mutate the input array', () => {
    const input: ChoosableTenancy[] = [t('a', '2024-01-01'), t('b', '2026-01-01')];
    const snapshot = input.map((x) => x.id);
    chooseTenancyTarget(input);
    expect(input.map((x) => x.id)).toEqual(snapshot);
  });

  it('exposes a stable list of choosable statuses including ended', () => {
    expect(CHOOSABLE_TENANCY_STATUSES).toContain('active');
    expect(CHOOSABLE_TENANCY_STATUSES).toContain('ended');
    expect(CHOOSABLE_TENANCY_STATUSES).not.toContain('cancelled');
    expect(CHOOSABLE_TENANCY_STATUSES).not.toContain('draft');
  });
});
