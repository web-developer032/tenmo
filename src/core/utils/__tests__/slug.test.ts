import { describe, expect, it } from 'vitest';
import { isSlug, slugify } from '@/core/utils/slug';

describe('slug/slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Morgan Lettings Ltd')).toBe('morgan-lettings-ltd');
  });

  it('strips diacritics-style characters via the alphanumeric filter', () => {
    expect(slugify('Café Lofts!!')).toBe('caf-lofts');
  });

  it('collapses repeated separators', () => {
    expect(slugify('Hello   __  world')).toBe('hello-world');
  });

  it('truncates at 60 chars', () => {
    const input = 'a'.repeat(120);
    expect(slugify(input).length).toBeLessThanOrEqual(60);
  });
});

describe('slug/isSlug', () => {
  it('accepts well-formed slugs', () => {
    expect(isSlug('morgan-lettings')).toBe(true);
    expect(isSlug('abc')).toBe(true);
  });

  it('rejects bad ones', () => {
    expect(isSlug('ab')).toBe(false);
    expect(isSlug('-leading-hyphen')).toBe(false);
    expect(isSlug('Has Capitals')).toBe(false);
    expect(isSlug('a'.repeat(61))).toBe(false);
  });
});
