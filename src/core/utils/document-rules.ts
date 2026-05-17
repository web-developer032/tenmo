import {
  DEFAULT_CATEGORIES_BY_KIND,
  DOCUMENT_BUCKET,
  DOCUMENT_CATEGORY_RULES,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_ALLOWLIST,
  type DocumentCategory,
  type DocumentKind,
  type DocumentMime,
} from '../constants/documents';

/**
 * Pure helpers for the document vault.
 *
 * Lives in `core/` (no `next`, `react`, `supabase` imports) so the same
 * logic can drive the upload UI, the server-side guard, and a future
 * Expo build.
 */

/** Strip path separators + non-portable characters from a filename, keep
 * the extension intact. */
export function sanitiseFilename(name: string): string {
  const trimmed = name.trim().replace(/[\\/]/g, '_');
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file';
}

/** 8 base36 chars + a millisecond suffix — collision-safe per parent. */
export function randomKey(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Build the canonical storage path. The first segment is `org_id` so the
 * `public.storage_object_org_id()` helper can authorise without a join. */
export function buildStoragePath(args: {
  orgId: string;
  kind: DocumentKind;
  parentId: string | null;
  filename: string;
}): string {
  const safe = sanitiseFilename(args.filename);
  // For `general` kind the path layout uses a constant segment in place of
  // a parent id so the URL still has a predictable five-segment shape.
  const parent = args.parentId ?? 'org';
  return `${args.orgId}/${args.kind}/${parent}/${randomKey()}-${safe}`;
}

export type ValidateUploadInput = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export type ValidateUploadResult = { ok: true } | { ok: false; error: 'mime' | 'size' | 'name' };

/** Pre-flight client check before asking the server for a signed URL. */
export function validateUploadCandidate(input: ValidateUploadInput): ValidateUploadResult {
  if (!input.filename || input.filename.trim().length === 0) return { ok: false, error: 'name' };
  if (!isAllowedMime(input.mimeType)) return { ok: false, error: 'mime' };
  if (input.sizeBytes <= 0 || input.sizeBytes > DOCUMENT_MAX_BYTES) {
    return { ok: false, error: 'size' };
  }
  return { ok: true };
}

export function isAllowedMime(mime: string): mime is DocumentMime {
  return (DOCUMENT_MIME_ALLOWLIST as readonly string[]).includes(mime);
}

/** Categories a tenant should be allowed to see for a given kind. */
export function tenantVisibleCategories(kind: DocumentKind): DocumentCategory[] {
  return (DEFAULT_CATEGORIES_BY_KIND[kind] ?? []).filter(
    (c) => !DOCUMENT_CATEGORY_RULES[c].landlordOnly,
  );
}

/** Categories suggested for a given kind, with landlord-only ones first hidden
 * from a tenant role. Used by the upload picker. */
export function suggestedCategories(
  kind: DocumentKind,
  role: 'landlord' | 'tenant',
): DocumentCategory[] {
  const base = DEFAULT_CATEGORIES_BY_KIND[kind] ?? [];
  if (role === 'landlord') return base;
  return base.filter((c) => !DOCUMENT_CATEGORY_RULES[c].landlordOnly);
}

/** Convert a byte count to a short human label ("3.2 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Best-effort label for the parent of a document, used in lists. */
export function parentTypeLabel(kind: DocumentKind): string {
  switch (kind) {
    case 'compliance':
      return 'Compliance item';
    case 'tenancy':
      return 'Tenancy';
    case 'property':
      return 'Property';
    case 'room':
      return 'Room';
    case 'general':
      return 'Org';
    default:
      return 'Document';
  }
}

export const BUCKET = DOCUMENT_BUCKET;
