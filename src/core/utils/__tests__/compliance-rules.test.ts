import { describe, expect, it } from 'vitest';
import { COMPLIANCE_RULES, type ComplianceType } from '@/core/constants/compliance';
import {
  complianceScore,
  derivedExpiresAt,
  groupByStatus,
  missingRequiredTypes,
  reminderBuckets,
  requiredItemsForProperty,
  tenancyActivationBlockers,
} from '@/core/utils/compliance-rules';

const item = (
  type: ComplianceType,
  status: 'ok' | 'due_soon' | 'overdue' | 'unknown',
  expires_at: string | null = null,
) => ({ type, status, expires_at });

describe('compliance-rules/requiredItemsForProperty', () => {
  it('returns the baseline 3 for non-HMO whole properties', () => {
    expect(requiredItemsForProperty('whole_property', false)).toEqual([
      'gas_safety',
      'eicr',
      'epc',
    ]);
  });

  it('adds HMO licence + FRA for explicit HMO type', () => {
    const list = requiredItemsForProperty('hmo_small', false);
    expect(list).toContain('hmo_licence');
    expect(list).toContain('fire_risk_assessment');
  });

  it('treats is_hmo=true the same as an hmo type', () => {
    const list = requiredItemsForProperty('flat', true);
    expect(list).toContain('hmo_licence');
  });
});

describe('compliance-rules/derivedExpiresAt', () => {
  it('adds validityMonths for fixed-validity types', () => {
    expect(derivedExpiresAt('gas_safety', '2026-04-01')).toBe('2027-04-01');
    expect(derivedExpiresAt('eicr', '2026-04-01')).toBe('2031-04-01');
    expect(derivedExpiresAt('epc', '2026-04-01')).toBe('2036-04-01');
  });

  it('returns null for types with no fixed validity', () => {
    expect(derivedExpiresAt('smoke_alarm_test', '2026-04-01')).toBeNull();
    expect(derivedExpiresAt('right_to_rent', '2026-04-01')).toBeNull();
    expect(derivedExpiresAt('deposit_protection', '2026-04-01')).toBeNull();
  });

  it('returns null when issuedAt is missing', () => {
    expect(derivedExpiresAt('gas_safety', null)).toBeNull();
    expect(derivedExpiresAt('gas_safety', undefined)).toBeNull();
  });
});

describe('compliance-rules/reminderBuckets', () => {
  it('always includes 0 (day-of-expiry) and is sorted descending', () => {
    const buckets = reminderBuckets();
    expect(buckets.at(-1)).toBe(0);
    for (let i = 1; i < buckets.length; i++) {
      const prev = buckets[i - 1] as number;
      const curr = buckets[i] as number;
      expect(prev).toBeGreaterThan(curr);
    }
  });

  it('contains every value from COMPLIANCE_RULES.reminderDaysBefore', () => {
    const buckets = new Set(reminderBuckets());
    for (const rule of Object.values(COMPLIANCE_RULES)) {
      for (const day of rule.reminderDaysBefore) {
        expect(buckets.has(day)).toBe(true);
      }
    }
  });
});

describe('compliance-rules/complianceScore', () => {
  it('returns 100 for empty input', () => {
    expect(complianceScore([])).toBe(100);
  });

  it('returns 100 when every required item is ok', () => {
    const items = [item('gas_safety', 'ok'), item('eicr', 'ok'), item('epc', 'ok')];
    expect(complianceScore(items)).toBe(100);
  });

  it('drops to 0 when everything is overdue', () => {
    const items = [item('gas_safety', 'overdue'), item('eicr', 'overdue')];
    expect(complianceScore(items)).toBe(0);
  });

  it('weights due_soon at 60% and unknown at 25%', () => {
    expect(complianceScore([item('gas_safety', 'due_soon')])).toBe(60);
    expect(complianceScore([item('gas_safety', 'unknown')], ['gas_safety'])).toBe(25);
  });

  it('ignores unknown items that are not required', () => {
    const items = [item('gas_safety', 'ok'), item('pat_test', 'unknown')];
    expect(complianceScore(items, ['gas_safety'])).toBe(100);
  });
});

describe('compliance-rules/groupByStatus', () => {
  it('buckets correctly and preserves order within buckets', () => {
    const a = { ...item('gas_safety', 'overdue'), id: 'a' };
    const b = { ...item('eicr', 'overdue'), id: 'b' };
    const c = { ...item('epc', 'ok'), id: 'c' };
    const out = groupByStatus([a, b, c]);
    expect(out.overdue.map((x) => x.id)).toEqual(['a', 'b']);
    expect(out.ok.map((x) => x.id)).toEqual(['c']);
    expect(out.due_soon).toEqual([]);
    expect(out.unknown).toEqual([]);
  });
});

describe('compliance-rules/missingRequiredTypes', () => {
  it('returns required types not present in items', () => {
    const items = [item('gas_safety', 'ok')];
    expect(missingRequiredTypes(items, ['gas_safety', 'eicr', 'epc'])).toEqual(['eicr', 'epc']);
  });

  it('returns nothing when everything is present', () => {
    const items = [item('gas_safety', 'ok'), item('eicr', 'overdue'), item('epc', 'unknown')];
    expect(missingRequiredTypes(items, ['gas_safety', 'eicr', 'epc'])).toEqual([]);
  });
});

describe('compliance-rules/tenancyActivationBlockers', () => {
  it('blocks when a required cert is overdue', () => {
    const items = [item('gas_safety', 'overdue'), item('eicr', 'ok'), item('epc', 'ok')];
    expect(tenancyActivationBlockers(items)).toEqual(['gas_safety']);
  });

  it('blocks when a required cert is missing entirely', () => {
    const items = [item('eicr', 'ok')];
    expect(tenancyActivationBlockers(items, ['gas_safety', 'eicr'])).toEqual(['gas_safety']);
  });

  it('returns empty when all required types are ok', () => {
    const items = [item('gas_safety', 'ok'), item('eicr', 'ok'), item('epc', 'ok')];
    expect(tenancyActivationBlockers(items)).toEqual([]);
  });

  it('skips non-blocking types like PAT', () => {
    const items = [item('gas_safety', 'ok'), item('eicr', 'ok'), item('epc', 'ok')];
    expect(tenancyActivationBlockers(items, ['gas_safety', 'eicr', 'epc', 'pat_test'])).toEqual([]);
  });
});
