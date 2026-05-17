import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env.server', () => ({
  getServerEnv: () => ({ DOCUSEAL_WEBHOOK_SECRET: 'docuseal-secret' }),
}));

import { AppError } from '@/lib/errors';
import { verifyDocuSealSignature } from '../signature';

const sign = (body: string, secret = 'docuseal-secret') =>
  createHmac('sha256', secret).update(body, 'utf8').digest('hex');

describe('verifyDocuSealSignature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a matching signature', () => {
    const body = '{"event_type":"submission.completed","data":{"id":1}}';
    expect(() => verifyDocuSealSignature(body, sign(body))).not.toThrow();
  });

  it('rejects a tampered body', () => {
    const body = '{"event_type":"submission.completed","data":{"id":1}}';
    const tampered = '{"event_type":"submission.completed","data":{"id":2}}';
    expect(() => verifyDocuSealSignature(tampered, sign(body))).toThrow(AppError);
  });

  it('rejects a signature signed with a different secret', () => {
    const body = '{"event_type":"submission.completed","data":{"id":1}}';
    expect(() => verifyDocuSealSignature(body, sign(body, 'other-secret'))).toThrow(AppError);
  });

  it('rejects when the signature header is missing', () => {
    expect(() => verifyDocuSealSignature('{}', null)).toThrow(/Missing/);
  });

  it('rejects malformed hex', () => {
    expect(() => verifyDocuSealSignature('{}', 'not-hex-at-all')).toThrow(AppError);
    expect(() => verifyDocuSealSignature('{}', 'abc')).toThrow(AppError);
  });
});
