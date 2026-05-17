import { describe, expect, it } from 'vitest';
import { shouldIgnoreSentryEvent, tracesSampleRate } from '../sentry-defaults';

describe('tracesSampleRate', () => {
  it('returns 0.1 in production', () => {
    expect(tracesSampleRate('production')).toBe(0.1);
  });

  it('returns 1.0 in dev / preview / undefined', () => {
    expect(tracesSampleRate('development')).toBe(1.0);
    expect(tracesSampleRate('preview')).toBe(1.0);
    expect(tracesSampleRate(undefined)).toBe(1.0);
  });
});

describe('shouldIgnoreSentryEvent', () => {
  it('drops Non-Error promise rejections (browser extension noise)', () => {
    expect(
      shouldIgnoreSentryEvent({
        message: 'Non-Error promise rejection captured with value: undefined',
      }),
    ).toBe(true);
  });

  it('drops AbortError messages from cancelled fetches', () => {
    expect(
      shouldIgnoreSentryEvent({
        exception: { values: [{ type: 'AbortError', value: 'AbortError: aborted' }] },
      }),
    ).toBe(true);
    expect(shouldIgnoreSentryEvent({ message: 'The user aborted a request.' })).toBe(true);
  });

  it('drops the benign ResizeObserver loop warning', () => {
    expect(
      shouldIgnoreSentryEvent({
        message: 'ResizeObserver loop limit exceeded',
      }),
    ).toBe(true);
  });

  it('keeps real errors', () => {
    expect(
      shouldIgnoreSentryEvent({
        exception: { values: [{ type: 'Error', value: 'Something exploded' }] },
      }),
    ).toBe(false);
    expect(shouldIgnoreSentryEvent({})).toBe(false);
  });
});
