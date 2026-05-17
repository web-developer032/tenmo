import { describe, expect, it } from 'vitest';
import {
  canCancelEnvelope,
  isEnvelopeOpen,
  isEnvelopeTerminal,
  needsAstSent,
  signUrlForRole,
} from '../ast-rules';

const baseEnvelope = {
  status: 'sent' as const,
  landlord_sign_url: 'https://ds.example/landlord',
  tenant_sign_url: 'https://ds.example/tenant',
};

describe('isEnvelopeOpen', () => {
  it('returns true for sent and opened', () => {
    expect(isEnvelopeOpen({ status: 'sent' })).toBe(true);
    expect(isEnvelopeOpen({ status: 'opened' })).toBe(true);
  });

  it('returns false for terminal states', () => {
    expect(isEnvelopeOpen({ status: 'completed' })).toBe(false);
    expect(isEnvelopeOpen({ status: 'declined' })).toBe(false);
    expect(isEnvelopeOpen({ status: 'expired' })).toBe(false);
    expect(isEnvelopeOpen({ status: 'cancelled' })).toBe(false);
  });

  it('handles null / undefined', () => {
    expect(isEnvelopeOpen(null)).toBe(false);
    expect(isEnvelopeOpen(undefined)).toBe(false);
  });
});

describe('isEnvelopeTerminal', () => {
  it('returns true for completed/declined/expired/cancelled', () => {
    expect(isEnvelopeTerminal({ status: 'completed' })).toBe(true);
    expect(isEnvelopeTerminal({ status: 'declined' })).toBe(true);
    expect(isEnvelopeTerminal({ status: 'expired' })).toBe(true);
    expect(isEnvelopeTerminal({ status: 'cancelled' })).toBe(true);
  });

  it('returns false for open states', () => {
    expect(isEnvelopeTerminal({ status: 'sent' })).toBe(false);
    expect(isEnvelopeTerminal({ status: 'opened' })).toBe(false);
  });
});

describe('canCancelEnvelope', () => {
  it('only allows cancellation of open envelopes', () => {
    expect(canCancelEnvelope('sent')).toBe(true);
    expect(canCancelEnvelope('opened')).toBe(true);
    expect(canCancelEnvelope('completed')).toBe(false);
    expect(canCancelEnvelope('declined')).toBe(false);
    expect(canCancelEnvelope('expired')).toBe(false);
    expect(canCancelEnvelope('cancelled')).toBe(false);
  });
});

describe('signUrlForRole', () => {
  it('returns the role-specific sign URL when open', () => {
    expect(signUrlForRole(baseEnvelope, 'landlord')).toBe('https://ds.example/landlord');
    expect(signUrlForRole(baseEnvelope, 'tenant')).toBe('https://ds.example/tenant');
  });

  it('returns null when the envelope is closed', () => {
    expect(signUrlForRole({ ...baseEnvelope, status: 'completed' }, 'tenant')).toBeNull();
    expect(signUrlForRole({ ...baseEnvelope, status: 'expired' }, 'landlord')).toBeNull();
  });

  it('returns null when the URL is missing', () => {
    expect(signUrlForRole({ ...baseEnvelope, tenant_sign_url: null }, 'tenant')).toBeNull();
  });
});

describe('needsAstSent', () => {
  it('returns true for null envelope', () => {
    expect(needsAstSent(null)).toBe(true);
    expect(needsAstSent(undefined)).toBe(true);
  });

  it('returns false for open + completed envelopes', () => {
    expect(needsAstSent({ status: 'sent' })).toBe(false);
    expect(needsAstSent({ status: 'opened' })).toBe(false);
    expect(needsAstSent({ status: 'completed' })).toBe(false);
  });

  it('returns true for terminal-but-not-completed envelopes', () => {
    expect(needsAstSent({ status: 'declined' })).toBe(true);
    expect(needsAstSent({ status: 'expired' })).toBe(true);
    expect(needsAstSent({ status: 'cancelled' })).toBe(true);
  });
});
