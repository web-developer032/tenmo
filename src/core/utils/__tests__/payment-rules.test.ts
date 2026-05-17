import { describe, expect, it } from 'vitest';
import type { GoCardlessMandate } from '@/core/schemas/payments';
import {
  canCollect,
  isChargeCollectable,
  mapGcFailureCause,
  needsMandateSetup,
  outstandingPence,
  paymentFailureCopy,
  previewGcFeePence,
} from '../payment-rules';

const mandate = (over: Partial<GoCardlessMandate> = {}): GoCardlessMandate => ({
  id: '00000000-0000-0000-0000-000000000001',
  org_id: '00000000-0000-0000-0000-000000000010',
  tenancy_id: '00000000-0000-0000-0000-000000000020',
  tenant_user_id: '00000000-0000-0000-0000-000000000030',
  gc_customer_id: 'CU_X',
  gc_mandate_id: 'MA_X',
  gc_redirect_flow_id: 'RE_X',
  gc_redirect_session_token: 'session-token',
  status: 'active',
  flow_redirect_url: null,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

describe('needsMandateSetup', () => {
  it('returns true when no mandate present', () => {
    expect(needsMandateSetup(null)).toBe(true);
    expect(needsMandateSetup(undefined)).toBe(true);
  });

  it('routes pending/submitted/active away from the setup CTA', () => {
    expect(needsMandateSetup(mandate({ status: 'pending_submission' }))).toBe(false);
    expect(needsMandateSetup(mandate({ status: 'submitted' }))).toBe(false);
    expect(needsMandateSetup(mandate({ status: 'active' }))).toBe(false);
  });

  it('routes cancelled/failed/expired back to setup', () => {
    expect(needsMandateSetup(mandate({ status: 'cancelled' }))).toBe(true);
    expect(needsMandateSetup(mandate({ status: 'failed' }))).toBe(true);
    expect(needsMandateSetup(mandate({ status: 'expired' }))).toBe(true);
  });
});

describe('canCollect', () => {
  it('requires active status AND a real gc_mandate_id', () => {
    expect(canCollect(null)).toBe(false);
    expect(canCollect(mandate({ status: 'submitted' }))).toBe(false);
    expect(canCollect(mandate({ status: 'active', gc_mandate_id: null }))).toBe(false);
    expect(canCollect(mandate({ status: 'active', gc_mandate_id: 'MA_1' }))).toBe(true);
  });
});

describe('outstandingPence', () => {
  it('clamps at zero on overpayment', () => {
    expect(outstandingPence({ amount_pence: 1000, paid_pence: 0 })).toBe(1000);
    expect(outstandingPence({ amount_pence: 1000, paid_pence: 600 })).toBe(400);
    expect(outstandingPence({ amount_pence: 1000, paid_pence: 1500 })).toBe(0);
  });
});

describe('isChargeCollectable', () => {
  const charge = { amount_pence: 1000, paid_pence: 0 };
  it('blocks when fully paid', () => {
    expect(isChargeCollectable({ ...charge, paid_pence: 1000, status: 'due' })).toBe(false);
  });
  it('allows due / overdue / partially_paid / upcoming', () => {
    for (const status of ['due', 'overdue', 'partially_paid', 'upcoming'] as const) {
      expect(isChargeCollectable({ ...charge, status })).toBe(true);
    }
  });
  it('blocks waived / cancelled / paid', () => {
    expect(isChargeCollectable({ ...charge, status: 'waived' })).toBe(false);
    expect(isChargeCollectable({ ...charge, status: 'cancelled' })).toBe(false);
    expect(isChargeCollectable({ ...charge, status: 'paid' })).toBe(false);
  });
});

describe('mapGcFailureCause', () => {
  it('passes through known reasons', () => {
    expect(mapGcFailureCause('insufficient_funds')).toBe('insufficient_funds');
    expect(mapGcFailureCause('mandate_cancelled')).toBe('mandate_cancelled');
    expect(mapGcFailureCause('bank_account_closed')).toBe('bank_account_closed');
  });

  it('falls back to unknown for everything else', () => {
    expect(mapGcFailureCause(null)).toBe('unknown');
    expect(mapGcFailureCause(undefined)).toBe('unknown');
    expect(mapGcFailureCause('something_new_we_dont_know')).toBe('unknown');
  });

  it('paymentFailureCopy returns triple of reason/label/hint', () => {
    const out = paymentFailureCopy('insufficient_funds');
    expect(out.reason).toBe('insufficient_funds');
    expect(out.label).toMatch(/insufficient/i);
    expect(out.hint).toMatch(/top up|pay manually/i);
  });
});

describe('previewGcFeePence', () => {
  it('returns zero on non-positive amounts', () => {
    expect(previewGcFeePence(0)).toBe(0);
    expect(previewGcFeePence(-1000)).toBe(0);
  });

  it('roughly matches 1% + 20p, capped at £4', () => {
    // £100 → ~£1.20
    expect(previewGcFeePence(10_000)).toBeGreaterThanOrEqual(120);
    expect(previewGcFeePence(10_000)).toBeLessThan(200);
    // £1000 → would be £10.20, capped at £4
    expect(previewGcFeePence(100_000)).toBe(400);
  });
});
