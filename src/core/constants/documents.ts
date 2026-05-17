/**
 * Document vault — kinds, categories, MIME allowlist, size limits.
 *
 * Source of truth for the database enums `document_kind` + `document_category`
 * (see migration `20260101001300_documents.sql`) and the upload UI.
 *
 * Adding a new kind / category? Add it here AND a new migration to extend
 * the enum (Postgres enums can be appended without a rewrite).
 */

export type DocumentKind = 'compliance' | 'tenancy' | 'property' | 'room' | 'general';

export type DocumentCategory =
  | 'certificate'
  | 'ast'
  | 'prescribed_information'
  | 'inventory'
  | 'photo'
  | 'receipt'
  | 'insurance'
  | 'manual'
  | 'identity'
  | 'other';

export const DOCUMENT_KIND_VALUES: DocumentKind[] = [
  'compliance',
  'tenancy',
  'property',
  'room',
  'general',
];

export const DOCUMENT_CATEGORY_VALUES: DocumentCategory[] = [
  'certificate',
  'ast',
  'prescribed_information',
  'inventory',
  'photo',
  'receipt',
  'insurance',
  'manual',
  'identity',
  'other',
];

export type DocumentCategoryRule = {
  category: DocumentCategory;
  label: string;
  /** One-line description shown in the picker. */
  description: string;
  /** Categories that should NEVER be visible to tenants (RTR ID copies, etc.). */
  landlordOnly: boolean;
};

export const DOCUMENT_CATEGORY_RULES: Record<DocumentCategory, DocumentCategoryRule> = {
  certificate: {
    category: 'certificate',
    label: 'Certificate',
    description: 'Statutory certs — Gas Safety, EICR, EPC, FRA, PAT, HMO licence.',
    landlordOnly: false,
  },
  ast: {
    category: 'ast',
    label: 'Tenancy agreement',
    description: 'Signed AST or other tenancy contracts.',
    landlordOnly: false,
  },
  prescribed_information: {
    category: 'prescribed_information',
    label: 'Prescribed information',
    description: 'Deposit prescribed information given to the tenant.',
    landlordOnly: false,
  },
  inventory: {
    category: 'inventory',
    label: 'Inventory',
    description: 'Schedule of condition / inventory of furnishings.',
    landlordOnly: false,
  },
  photo: {
    category: 'photo',
    label: 'Photo',
    description: 'Property or room photos.',
    landlordOnly: false,
  },
  receipt: {
    category: 'receipt',
    label: 'Receipt',
    description: 'Repair invoices, contractor receipts, expenses.',
    landlordOnly: true,
  },
  insurance: {
    category: 'insurance',
    label: 'Insurance',
    description: 'Landlord insurance policies and renewals.',
    landlordOnly: true,
  },
  manual: {
    category: 'manual',
    label: 'Manual',
    description: 'Boiler / appliance manuals.',
    landlordOnly: false,
  },
  identity: {
    category: 'identity',
    label: 'Identity (RTR)',
    description: 'Passport / BRP / share-code copies for Right to Rent. Never shown to tenants.',
    landlordOnly: true,
  },
  other: {
    category: 'other',
    label: 'Other',
    description: 'Anything that does not fit the categories above.',
    landlordOnly: false,
  },
};

/** Allowed MIME types for the `tenantly-documents` bucket. Mirrors the
 * `allowed_mime_types` set on the bucket itself. */
export const DOCUMENT_MIME_ALLOWLIST = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

export type DocumentMime = (typeof DOCUMENT_MIME_ALLOWLIST)[number];

/** Max file size in bytes for the bucket (50 MiB). */
export const DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;

/** Bucket id (must match the migration). */
export const DOCUMENT_BUCKET = 'tenantly-documents';

/** UI default page size for the documents list. */
export const DOCUMENT_PAGE_SIZE = 20;

/** Default categories presented when uploading against each kind, ordered. */
export const DEFAULT_CATEGORIES_BY_KIND: Record<DocumentKind, DocumentCategory[]> = {
  compliance: ['certificate', 'other'],
  tenancy: ['ast', 'prescribed_information', 'inventory', 'identity', 'other'],
  property: ['photo', 'insurance', 'manual', 'receipt', 'other'],
  room: ['photo', 'inventory', 'other'],
  general: ['other', 'insurance', 'manual'],
};
