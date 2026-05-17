import { describe, expect, it } from 'vitest';
import type { OrgUsage } from '@/core/schemas/billing';
import {
  checkFeatureAllowed,
  checkResourceAllowed,
  compareTier,
  effectiveTier,
  formatPriceGBP,
  hasFeature,
  nextTierThatAllows,
  tierLimits,
  usagePercent,
} from '../tier-rules';

const subFree = { tier: 'free' as const, status: 'free' as const };
const subStarterActive = { tier: 'starter' as const, status: 'active' as const };
const subStarterPastDue = { tier: 'starter' as const, status: 'past_due' as const };
const subProActive = { tier: 'pro' as const, status: 'active' as const };
const subProtfolioActive = { tier: 'portfolio' as const, status: 'active' as const };

const usage = (over: Partial<OrgUsage> = {}): OrgUsage => ({
  properties: 0,
  rooms: 0,
  tenancies: 0,
  org_members: 1,
  ...over,
});

describe('effectiveTier', () => {
  it('returns the actual tier when active', () => {
    expect(effectiveTier(subStarterActive)).toBe('starter');
    expect(effectiveTier(subProActive)).toBe('pro');
  });

  it('returns free when subscription is missing', () => {
    expect(effectiveTier(null)).toBe('free');
  });

  it('locks to free when status is past_due', () => {
    expect(effectiveTier(subStarterPastDue)).toBe('free');
  });

  it('locks to free for canceled / unpaid / incomplete', () => {
    expect(effectiveTier({ tier: 'pro', status: 'canceled' })).toBe('free');
    expect(effectiveTier({ tier: 'pro', status: 'unpaid' })).toBe('free');
    expect(effectiveTier({ tier: 'pro', status: 'incomplete' })).toBe('free');
  });

  it('treats trialing as active', () => {
    expect(effectiveTier({ tier: 'pro', status: 'trialing' })).toBe('pro');
  });
});

describe('tierLimits', () => {
  it('returns the right caps for free', () => {
    expect(tierLimits('free')).toEqual({
      properties: 1,
      rooms: 1,
      tenancies: 1,
      org_members: 1,
    });
  });

  it('returns nulls (unlimited) for portfolio', () => {
    const limits = tierLimits('portfolio');
    expect(limits.properties).toBeNull();
    expect(limits.rooms).toBeNull();
    expect(limits.tenancies).toBeNull();
    expect(limits.org_members).toBeNull();
  });
});

describe('checkResourceAllowed', () => {
  it('allows when under cap', () => {
    const res = checkResourceAllowed('properties', subStarterActive, usage({ properties: 2 }));
    expect(res.allowed).toBe(true);
  });

  it('blocks at cap with limit_reached + suggested next tier', () => {
    const res = checkResourceAllowed('properties', subFree, usage({ properties: 1 }));
    expect(res.allowed).toBe(false);
    if (res.allowed === true) throw new Error('expected block');
    expect(res.reason).toBe('limit_reached');
    expect(res.currentTier).toBe('free');
    expect(res.suggestedTier).toBe('starter');
    expect(res.limit).toBe(1);
    expect(res.message).toContain('Free plan');
    expect(res.message).toContain('Starter');
  });

  it('blocks with feature_locked when status is past_due', () => {
    const res = checkResourceAllowed('properties', subStarterPastDue, usage({ properties: 1 }));
    expect(res.allowed).toBe(false);
    if (res.allowed === true) throw new Error('expected block');
    expect(res.reason).toBe('feature_locked');
    expect(res.currentTier).toBe('free');
    expect(res.message).toMatch(/paused|past due/i);
  });

  it('always allows for portfolio (unlimited)', () => {
    const res = checkResourceAllowed('properties', subProtfolioActive, usage({ properties: 9999 }));
    expect(res.allowed).toBe(true);
  });

  it('treats null subscription as free tier', () => {
    const ok = checkResourceAllowed('properties', null, usage({ properties: 0 }));
    expect(ok.allowed).toBe(true);
    const denied = checkResourceAllowed('properties', null, usage({ properties: 1 }));
    expect(denied.allowed).toBe(false);
  });
});

describe('nextTierThatAllows', () => {
  it('finds the first tier that fits the count', () => {
    expect(nextTierThatAllows('properties', 3, 'free')).toBe('starter');
    expect(nextTierThatAllows('properties', 6, 'free')).toBe('pro');
    expect(nextTierThatAllows('properties', 30, 'free')).toBe('portfolio');
  });

  it('starts the search above the current tier', () => {
    expect(nextTierThatAllows('properties', 6, 'starter')).toBe('pro');
  });

  it('returns null if no tier suffices (impossible with portfolio = unlimited)', () => {
    expect(nextTierThatAllows('properties', 1, 'portfolio')).toBeNull();
  });
});

describe('usagePercent', () => {
  it('rounds to nearest integer', () => {
    expect(usagePercent('properties', 'starter', usage({ properties: 1 }))).toBe(20);
    expect(usagePercent('rooms', 'starter', usage({ rooms: 13 }))).toBe(52);
  });

  it('caps at 100', () => {
    expect(usagePercent('properties', 'free', usage({ properties: 5 }))).toBe(100);
  });

  it('returns 0 for unlimited tiers', () => {
    expect(usagePercent('properties', 'portfolio', usage({ properties: 9999 }))).toBe(0);
  });
});

describe('formatPriceGBP', () => {
  it('formats integer £ values without decimals', () => {
    expect(formatPriceGBP(1200)).toBe('£12');
    expect(formatPriceGBP(2900)).toBe('£29');
  });

  it('formats sub-pound values with decimals', () => {
    expect(formatPriceGBP(1250)).toBe('£12.50');
  });

  it('renders £0 for zero', () => {
    expect(formatPriceGBP(0)).toBe('£0');
  });
});

describe('compareTier', () => {
  it('orders free < starter < pro < portfolio', () => {
    expect(compareTier('free', 'starter')).toBeLessThan(0);
    expect(compareTier('pro', 'starter')).toBeGreaterThan(0);
    expect(compareTier('starter', 'starter')).toBe(0);
  });
});

describe('hasFeature', () => {
  it('Free has no paid features', () => {
    expect(hasFeature(subFree, 'rent_collection_dd')).toBe(false);
    expect(hasFeature(subFree, 'mtd_export')).toBe(false);
    expect(hasFeature(subFree, 'ai_maintenance_triage')).toBe(false);
  });

  it('Starter unlocks DD + Open Banking + MTD', () => {
    expect(hasFeature(subStarterActive, 'rent_collection_dd')).toBe(true);
    expect(hasFeature(subStarterActive, 'open_banking_payments')).toBe(true);
    expect(hasFeature(subStarterActive, 'mtd_export')).toBe(true);
    expect(hasFeature(subStarterActive, 'ai_maintenance_triage')).toBe(false);
  });

  it('Pro unlocks AI features', () => {
    expect(hasFeature(subProActive, 'ai_maintenance_triage')).toBe(true);
    expect(hasFeature(subProActive, 'ai_notice_drafting')).toBe(true);
    expect(hasFeature(subProActive, 'sub_account_management')).toBe(false);
  });

  it('Portfolio unlocks everything', () => {
    expect(hasFeature(subProtfolioActive, 'sub_account_management')).toBe(true);
    expect(hasFeature(subProtfolioActive, 'white_label')).toBe(true);
  });

  it('past_due downgrades effective tier and locks paid features', () => {
    expect(hasFeature(subStarterPastDue, 'rent_collection_dd')).toBe(false);
  });
});

describe('checkFeatureAllowed', () => {
  it('returns allowed=true on entitled tiers', () => {
    expect(checkFeatureAllowed('rent_collection_dd', subStarterActive).allowed).toBe(true);
  });

  it('Free tenants get a feature_not_in_tier rejection with starter as suggestion', () => {
    const out = checkFeatureAllowed('rent_collection_dd', subFree);
    expect(out.allowed).toBe(false);
    if (!out.allowed) {
      expect(out.reason).toBe('feature_not_in_tier');
      expect(out.currentTier).toBe('free');
      expect(out.suggestedTier).toBe('starter');
      expect(out.message).toMatch(/Direct Debit/i);
      expect(out.message).toMatch(/Starter/);
    }
  });

  it('past_due Starter is feature_locked rather than feature_not_in_tier', () => {
    const out = checkFeatureAllowed('rent_collection_dd', subStarterPastDue);
    expect(out.allowed).toBe(false);
    if (!out.allowed) {
      expect(out.reason).toBe('feature_locked');
      expect(out.currentTier).toBe('free');
      expect(out.suggestedTier).toBe('starter');
    }
  });

  it('AI features suggest Pro from Starter', () => {
    const out = checkFeatureAllowed('ai_maintenance_triage', subStarterActive);
    expect(out.allowed).toBe(false);
    if (!out.allowed) {
      expect(out.suggestedTier).toBe('pro');
    }
  });

  it('white_label suggests Portfolio', () => {
    const out = checkFeatureAllowed('white_label', subProActive);
    expect(out.allowed).toBe(false);
    if (!out.allowed) {
      expect(out.suggestedTier).toBe('portfolio');
    }
  });
});
