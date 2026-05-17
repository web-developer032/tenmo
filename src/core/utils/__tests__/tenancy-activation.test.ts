import { describe, expect, it } from 'vitest';
import { deriveActivationBlockers } from '../tenancy-activation';

const happyPath = {
  tenant_user_id: 'user-1',
  ast_signed_at: '2026-01-01T00:00:00Z',
  deposit_pence: 100000,
  deposit_protected_at: '2026-01-02T00:00:00Z',
  rtr_current: true,
  start_date: '2026-01-01',
  today: '2026-04-29',
};

describe('deriveActivationBlockers', () => {
  it('returns canActivate=true with no blockers when all prerequisites met', () => {
    const decision = deriveActivationBlockers(happyPath);
    expect(decision.canActivate).toBe(true);
    expect(decision.blockers).toHaveLength(0);
  });

  it('flags missing tenant accept', () => {
    const decision = deriveActivationBlockers({ ...happyPath, tenant_user_id: null });
    expect(decision.canActivate).toBe(false);
    expect(decision.blockers.map((b) => b.code)).toContain('tenant_not_accepted');
  });

  it('flags unsigned AST', () => {
    const decision = deriveActivationBlockers({ ...happyPath, ast_signed_at: null });
    expect(decision.blockers.map((b) => b.code)).toContain('ast_not_signed');
  });

  it('flags unprotected deposit when deposit > 0', () => {
    const decision = deriveActivationBlockers({ ...happyPath, deposit_protected_at: null });
    expect(decision.blockers.map((b) => b.code)).toContain('deposit_not_protected');
  });

  it('does NOT flag deposit when deposit_pence is 0', () => {
    const decision = deriveActivationBlockers({
      ...happyPath,
      deposit_pence: 0,
      deposit_protected_at: null,
    });
    expect(decision.blockers.map((b) => b.code)).not.toContain('deposit_not_protected');
  });

  it('flags missing RTR', () => {
    const decision = deriveActivationBlockers({ ...happyPath, rtr_current: false });
    expect(decision.blockers.map((b) => b.code)).toContain('rtr_not_current');
  });

  it('flags future start date', () => {
    const decision = deriveActivationBlockers({
      ...happyPath,
      start_date: '2030-01-01',
    });
    expect(decision.blockers.map((b) => b.code)).toContain('start_date_in_future');
  });

  it('returns multiple blockers when multiple things are missing', () => {
    const decision = deriveActivationBlockers({
      tenant_user_id: null,
      ast_signed_at: null,
      deposit_pence: 100000,
      deposit_protected_at: null,
      rtr_current: false,
      start_date: '2030-01-01',
      today: '2026-04-29',
    });
    expect(decision.canActivate).toBe(false);
    expect(decision.blockers).toHaveLength(5);
  });
});
