import { z } from 'zod';
import {
  DOCUMENT_CATEGORY_VALUES,
  DOCUMENT_KIND_VALUES,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_ALLOWLIST,
  type DocumentCategory,
  type DocumentKind,
  type DocumentMime,
} from '../constants/documents';
import { uuid } from './common';

/**
 * Document schemas.
 *
 * Mirrors the `public.documents` table (migration `20260101001300_documents.sql`).
 *
 * `parent` is modelled as a discriminated union on `kind` so the API + UI
 * cannot construct an "AST attached to a property" or similar nonsense
 * payload — the database CHECK constraint also enforces this server-side.
 */

export const DocumentKindEnum = z.enum(DOCUMENT_KIND_VALUES as [DocumentKind, ...DocumentKind[]]);

export const DocumentCategoryEnum = z.enum(
  DOCUMENT_CATEGORY_VALUES as [DocumentCategory, ...DocumentCategory[]],
);

export const DocumentMimeEnum = z.enum(
  DOCUMENT_MIME_ALLOWLIST as unknown as [DocumentMime, ...DocumentMime[]],
);

/** Discriminated parent — exactly one ID set, dictated by `kind`. */
export const DocumentParent = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('compliance'), compliance_item_id: uuid }),
  z.object({ kind: z.literal('tenancy'), tenancy_id: uuid }),
  z.object({ kind: z.literal('property'), property_id: uuid }),
  z.object({ kind: z.literal('room'), room_id: uuid }),
  z.object({ kind: z.literal('general') }),
]);

export type DocumentParent = z.infer<typeof DocumentParent>;

/** A single row from `public.documents`, as read from the DB. */
export const Document = z.object({
  id: uuid,
  org_id: uuid,
  kind: DocumentKindEnum,
  category: DocumentCategoryEnum,

  property_id: uuid.nullable(),
  room_id: uuid.nullable(),
  tenancy_id: uuid.nullable(),
  compliance_item_id: uuid.nullable(),

  storage_path: z.string().min(1),
  filename: z.string().min(1).max(200),
  mime_type: z.string().min(1),
  size_bytes: z.number().int().positive(),

  title: z.string().nullable(),
  description: z.string().nullable(),

  uploaded_by: uuid,
  created_at: z.string(),
  updated_at: z.string(),
});

export type Document = z.infer<typeof Document>;

/** Input for "give me a signed upload URL" — does NOT yet write a row. */
export const CreateUploadUrlInput = z.object({
  parent: DocumentParent,
  category: DocumentCategoryEnum,
  filename: z.string().trim().min(1).max(180),
  mime_type: DocumentMimeEnum,
  size_bytes: z.number().int().positive().max(DOCUMENT_MAX_BYTES, 'File too large'),
});

export type CreateUploadUrlInput = z.infer<typeof CreateUploadUrlInput>;

/** Response from the signed-upload-URL endpoint. */
export const UploadUrlResponse = z.object({
  storage_path: z.string(),
  signed_url: z.string(),
  token: z.string(),
  expires_in_seconds: z.number().int().positive(),
});

export type UploadUrlResponse = z.infer<typeof UploadUrlResponse>;

/** Input for "I just uploaded — please record the row." */
export const RecordDocumentInput = z.object({
  parent: DocumentParent,
  category: DocumentCategoryEnum,
  storage_path: z.string().min(1),
  filename: z.string().trim().min(1).max(200),
  mime_type: DocumentMimeEnum,
  size_bytes: z.number().int().positive().max(DOCUMENT_MAX_BYTES),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
});

export type RecordDocumentInput = z.infer<typeof RecordDocumentInput>;

/** List filter for the vault page + per-entity tabs. */
export const DocumentListFilter = z.object({
  org_id: uuid.optional(),
  kind: DocumentKindEnum.optional(),
  categories: z.array(DocumentCategoryEnum).optional(),
  property_id: uuid.optional(),
  room_id: uuid.optional(),
  tenancy_id: uuid.optional(),
  compliance_item_id: uuid.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  before: z.string().optional(),
});

export type DocumentListFilter = z.infer<typeof DocumentListFilter>;
