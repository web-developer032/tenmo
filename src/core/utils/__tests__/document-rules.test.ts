import { describe, expect, it } from 'vitest';
import { DOCUMENT_MAX_BYTES } from '@/core/constants/documents';
import {
  buildStoragePath,
  formatBytes,
  isAllowedMime,
  parentTypeLabel,
  randomKey,
  sanitiseFilename,
  suggestedCategories,
  tenantVisibleCategories,
  validateUploadCandidate,
} from '@/core/utils/document-rules';

describe('document-rules/sanitiseFilename', () => {
  it('replaces path separators and oddball chars with underscores', () => {
    expect(sanitiseFilename('foo/bar baz?.pdf')).toBe('foo_bar_baz_.pdf');
    expect(sanitiseFilename('..\\..\\evil.pdf')).toBe('.._.._evil.pdf');
  });

  it('keeps the extension intact and clamps to 120 chars', () => {
    const long = `${'a'.repeat(300)}.pdf`;
    const out = sanitiseFilename(long);
    expect(out.length).toBeLessThanOrEqual(120);
  });

  it('falls back to "file" when input is empty after cleaning', () => {
    expect(sanitiseFilename('   ')).toBe('file');
    expect(sanitiseFilename('???')).toBe('_');
  });
});

describe('document-rules/randomKey', () => {
  it('produces unique enough strings', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(randomKey());
    expect(seen.size).toBe(200);
  });
});

describe('document-rules/buildStoragePath', () => {
  it('emits {orgId}/{kind}/{parentId}/{nanoid-name} for compliance', () => {
    const path = buildStoragePath({
      orgId: 'org123',
      kind: 'compliance',
      parentId: 'item456',
      filename: 'cp12.pdf',
    });
    expect(path.startsWith('org123/compliance/item456/')).toBe(true);
    expect(path.endsWith('-cp12.pdf')).toBe(true);
  });

  it('uses literal "org" segment when parentId is null (general kind)', () => {
    const path = buildStoragePath({
      orgId: 'org123',
      kind: 'general',
      parentId: null,
      filename: 'note.pdf',
    });
    const segs = path.split('/');
    expect(segs[0]).toBe('org123');
    expect(segs[1]).toBe('general');
    expect(segs[2]).toBe('org');
  });
});

describe('document-rules/isAllowedMime', () => {
  it('accepts the bucket allow-list', () => {
    expect(isAllowedMime('application/pdf')).toBe(true);
    expect(isAllowedMime('image/png')).toBe(true);
    expect(isAllowedMime('image/heic')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isAllowedMime('text/plain')).toBe(false);
    expect(isAllowedMime('application/x-msdownload')).toBe(false);
    expect(isAllowedMime('')).toBe(false);
  });
});

describe('document-rules/validateUploadCandidate', () => {
  it('passes a normal pdf', () => {
    expect(
      validateUploadCandidate({
        filename: 'cp12.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      }),
    ).toEqual({ ok: true });
  });

  it('rejects unknown mime types', () => {
    expect(
      validateUploadCandidate({
        filename: 'evil.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 1024,
      }),
    ).toEqual({ ok: false, error: 'mime' });
  });

  it('rejects oversize files', () => {
    expect(
      validateUploadCandidate({
        filename: 'big.pdf',
        mimeType: 'application/pdf',
        sizeBytes: DOCUMENT_MAX_BYTES + 1,
      }),
    ).toEqual({ ok: false, error: 'size' });
  });

  it('rejects empty filename', () => {
    expect(
      validateUploadCandidate({
        filename: '   ',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      }),
    ).toEqual({ ok: false, error: 'name' });
  });
});

describe('document-rules/category visibility', () => {
  it('hides landlord-only categories from tenants', () => {
    const tenantTenancyCats = tenantVisibleCategories('tenancy');
    expect(tenantTenancyCats).not.toContain('identity');

    const tenantPropertyCats = tenantVisibleCategories('property');
    expect(tenantPropertyCats).not.toContain('insurance');
    expect(tenantPropertyCats).not.toContain('receipt');
  });

  it('exposes the same categories to landlords as the default set', () => {
    const landlord = suggestedCategories('tenancy', 'landlord');
    expect(landlord).toContain('identity');
  });

  it('strips landlord-only categories for tenants in suggestedCategories', () => {
    const tenant = suggestedCategories('tenancy', 'tenant');
    expect(tenant).not.toContain('identity');
  });
});

describe('document-rules/formatBytes', () => {
  it('prints B / KB / MB at the right thresholds', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1500)).toBe('1.5 KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});

describe('document-rules/parentTypeLabel', () => {
  it('returns a human label per kind', () => {
    expect(parentTypeLabel('compliance')).toBe('Compliance item');
    expect(parentTypeLabel('tenancy')).toBe('Tenancy');
    expect(parentTypeLabel('property')).toBe('Property');
    expect(parentTypeLabel('room')).toBe('Room');
    expect(parentTypeLabel('general')).toBe('Org');
  });
});
