import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env.server', () => ({
  getServerEnv: () => ({ GOCARDLESS_WEBHOOK_SECRET: 'test-secret' }),
}));

import { AppError } from '@/lib/errors';
import { verifyGoCardlessSignature } from '../signature';

const sign = (body: string, secret = 'test-secret') =>
  createHmac('sha256', secret).update(body, 'utf8').digest('hex');

describe('verifyGoCardlessSignature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a matching signature', () => {
    const body = '{"events":[{"id":"EV1"}]}';
    expect(() => verifyGoCardlessSignature(body, sign(body))).not.toThrow();
  });

  it('rejects a tampered body', () => {
    const body = '{"events":[{"id":"EV1"}]}';
    const tampered = '{"events":[{"id":"EV2"}]}';
    expect(() => verifyGoCardlessSignature(tampered, sign(body))).toThrow(AppError);
  });

  it('rejects a wrong secret', () => {
    const body = '{"events":[{"id":"EV1"}]}';
    expect(() => verifyGoCardlessSignature(body, sign(body, 'other-secret'))).toThrow(AppError);
  });

  it('rejects when the signature header is missing', () => {
    expect(() => verifyGoCardlessSignature('{}', null)).toThrow(/Missing/);
  });

  it('rejects malformed hex', () => {
    expect(() => verifyGoCardlessSignature('{}', 'not-hex-at-all')).toThrow(AppError);
    expect(() => verifyGoCardlessSignature('{}', 'abc')).toThrow(AppError);
  });
});
