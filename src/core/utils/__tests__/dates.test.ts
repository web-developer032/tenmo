import { describe, expect, it } from 'vitest';
import { complianceStatus, daysUntil, humaniseDeadline } from '@/core/utils/dates';

const NOW = new Date('2026-04-26T12:00:00Z');

describe('dates/complianceStatus', () => {
  it('returns "unknown" when no expiry is set', () => {
    expect(complianceStatus(null, NOW)).toBe('unknown');
    expect(complianceStatus(undefined, NOW)).toBe('unknown');
  });

  it('returns "overdue" when expiry is in the past', () => {
    expect(complianceStatus('2026-04-25', NOW)).toBe('overdue');
  });

  it('returns "due_soon" within 30 days', () => {
    expect(complianceStatus('2026-05-10', NOW)).toBe('due_soon');
    expect(complianceStatus('2026-05-26', NOW)).toBe('due_soon');
  });

  it('returns "ok" beyond 30 days', () => {
    expect(complianceStatus('2026-06-30', NOW)).toBe('ok');
  });
});

describe('dates/daysUntil', () => {
  it('returns negative for past dates', () => {
    expect(daysUntil('2026-04-20', NOW)).toBeLessThan(0);
  });
  it('returns positive for future dates', () => {
    expect(daysUntil('2026-05-26', NOW)).toBe(30);
  });
});

describe('dates/humaniseDeadline', () => {
  it('uses friendly relative phrasing', () => {
    expect(humaniseDeadline('2026-04-26', NOW)).toBe('Due today');
    expect(humaniseDeadline('2026-04-27', NOW)).toBe('Due tomorrow');
    expect(humaniseDeadline('2026-04-25', NOW)).toBe('Overdue by 1 day');
  });
});
