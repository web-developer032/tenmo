import { describe, expect, it } from 'vitest';
import { LookupByEmailInput } from '../server/lookup-by-email';

/**
 * The `lookupProfileByEmail` server helper is exercised end-to-end via the
 * route handler test in CI; here we cover the input schema, which is the
 * pure piece that's safe to unit-test without a Supabase service client.
 */
describe('LookupByEmailInput', () => {
  it('rejects empty / missing email', () => {
    expect(() => LookupByEmailInput.parse({})).toThrow();
    expect(() => LookupByEmailInput.parse({ email: '' })).toThrow();
  });

  it('rejects non-email strings', () => {
    expect(() => LookupByEmailInput.parse({ email: 'notanemail' })).toThrow();
    expect(() => LookupByEmailInput.parse({ email: '@example.com' })).toThrow();
    expect(() => LookupByEmailInput.parse({ email: 'a@' })).toThrow();
  });

  it('accepts a valid email', () => {
    const parsed = LookupByEmailInput.parse({ email: 'alice@example.com' });
    expect(parsed.email).toBe('alice@example.com');
  });

  it('preserves case (normalisation happens inside the server helper)', () => {
    const parsed = LookupByEmailInput.parse({ email: 'Alice@Example.com' });
    expect(parsed.email).toBe('Alice@Example.com');
  });
});
