import { describe, expect, it } from 'vitest';
import {
  mapGcMandateStatus,
  mapGcPaymentStatus,
  mapMandateActionToStatus,
  mapPaymentActionToStatus,
} from '../webhook-mapping';

describe('mapMandateActionToStatus', () => {
  it('handles the documented happy path', () => {
    expect(mapMandateActionToStatus('created')).toBe('pending_submission');
    expect(mapMandateActionToStatus('submitted')).toBe('submitted');
    expect(mapMandateActionToStatus('active')).toBe('active');
    expect(mapMandateActionToStatus('reinstated')).toBe('active');
  });

  it('collapses cancelled / customer_approval_denied to cancelled', () => {
    expect(mapMandateActionToStatus('cancelled')).toBe('cancelled');
    expect(mapMandateActionToStatus('customer_approval_denied')).toBe('cancelled');
  });

  it('preserves failed / expired distinctly', () => {
    expect(mapMandateActionToStatus('failed')).toBe('failed');
    expect(mapMandateActionToStatus('expired')).toBe('expired');
  });

  it('returns null on unknown actions so the caller logs + skips', () => {
    expect(mapMandateActionToStatus('something_new')).toBeNull();
    expect(mapMandateActionToStatus('')).toBeNull();
  });
});

describe('mapGcMandateStatus', () => {
  it('maps GC-side statuses 1:1 where possible', () => {
    expect(mapGcMandateStatus('active')).toBe('active');
    expect(mapGcMandateStatus('expired')).toBe('expired');
  });

  it('collapses pending_customer_approval into pending_submission', () => {
    expect(mapGcMandateStatus('pending_customer_approval')).toBe('pending_submission');
    expect(mapGcMandateStatus('pending_submission')).toBe('pending_submission');
  });

  it('treats cancelled / consumed / blocked as cancelled', () => {
    expect(mapGcMandateStatus('cancelled')).toBe('cancelled');
    expect(mapGcMandateStatus('consumed')).toBe('cancelled');
    expect(mapGcMandateStatus('blocked')).toBe('cancelled');
  });

  it('falls back to failed for unrecognised values', () => {
    expect(mapGcMandateStatus('something_new' as never)).toBe('failed');
  });
});

describe('mapPaymentActionToStatus', () => {
  it('treats created/submitted as pending', () => {
    expect(mapPaymentActionToStatus('created')).toBe('pending');
    expect(mapPaymentActionToStatus('submitted')).toBe('pending');
  });

  it('treats confirmed/paid_out as confirmed (we settle on confirmed)', () => {
    expect(mapPaymentActionToStatus('confirmed')).toBe('confirmed');
    expect(mapPaymentActionToStatus('paid_out')).toBe('confirmed');
  });

  it('treats failed / cancelled / customer_approval_denied as failed', () => {
    expect(mapPaymentActionToStatus('failed')).toBe('failed');
    expect(mapPaymentActionToStatus('cancelled')).toBe('failed');
    expect(mapPaymentActionToStatus('customer_approval_denied')).toBe('failed');
  });

  it('treats charged_back / late_failure_settled as charged_back', () => {
    expect(mapPaymentActionToStatus('charged_back')).toBe('charged_back');
    expect(mapPaymentActionToStatus('late_failure_settled')).toBe('charged_back');
  });

  it('returns null on unknown actions', () => {
    expect(mapPaymentActionToStatus('something_new')).toBeNull();
  });
});

describe('mapGcPaymentStatus', () => {
  it('maps GC-side statuses to ours', () => {
    expect(mapGcPaymentStatus('confirmed')).toBe('confirmed');
    expect(mapGcPaymentStatus('paid_out')).toBe('confirmed');
    expect(mapGcPaymentStatus('failed')).toBe('failed');
    expect(mapGcPaymentStatus('charged_back')).toBe('charged_back');
    expect(mapGcPaymentStatus('pending_customer_approval')).toBe('pending');
  });

  it('falls back to failed on unknown', () => {
    expect(mapGcPaymentStatus('something_new' as never)).toBe('failed');
  });
});
