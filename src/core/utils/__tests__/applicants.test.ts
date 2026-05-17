import { describe, expect, it } from 'vitest';
import {
  activeApplicantCount,
  sortApplicantsForLandlordQueue,
  summariseApplicants,
  ZERO_COUNTS,
} from '../applicants';

type FakeApp = {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  applied_at: string;
};

const apps: FakeApp[] = [
  { id: 'a', status: 'pending', applied_at: '2026-04-01T00:00:00Z' },
  { id: 'b', status: 'pending', applied_at: '2026-04-03T00:00:00Z' },
  { id: 'c', status: 'rejected', applied_at: '2026-04-02T00:00:00Z' },
  { id: 'd', status: 'accepted', applied_at: '2026-04-04T00:00:00Z' },
  { id: 'e', status: 'withdrawn', applied_at: '2026-03-30T00:00:00Z' },
];

describe('summariseApplicants', () => {
  it('returns ZERO_COUNTS for an empty array', () => {
    expect(summariseApplicants([])).toEqual(ZERO_COUNTS);
  });

  it('counts each status correctly', () => {
    expect(summariseApplicants(apps)).toEqual({
      pending: 2,
      accepted: 1,
      rejected: 1,
      withdrawn: 1,
    });
  });
});

describe('activeApplicantCount', () => {
  it('counts pending + accepted + rejected (non-withdrawn)', () => {
    expect(activeApplicantCount(summariseApplicants(apps))).toBe(4);
  });
});

describe('sortApplicantsForLandlordQueue', () => {
  it('puts accepted first, then pending oldest-first, then rejected/withdrawn newest-first', () => {
    const sorted = sortApplicantsForLandlordQueue(apps);
    expect(sorted.map((a) => a.id)).toEqual(['d', 'a', 'b', 'c', 'e']);
  });

  it('does not mutate the input array', () => {
    const before = [...apps];
    sortApplicantsForLandlordQueue(apps);
    expect(apps.map((a) => a.id)).toEqual(before.map((a) => a.id));
  });
});
