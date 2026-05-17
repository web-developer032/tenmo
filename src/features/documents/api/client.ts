/**
 * Browser API client for the document vault.
 *
 * Three-step upload flow (mirrors Phase F ticket attachments):
 *   1. requestUploadUrl(...) — server mints a signed PUT URL.
 *   2. PUT the bytes directly to Supabase Storage at that URL.
 *   3. recordDocument(...) — server creates the row + fan-outs notifications.
 *
 * Read flow:
 *   - listDocumentsApi(filter) for the vault list.
 *   - openDocument(id) opens a 1-hour signed URL in a new tab.
 *   - deleteDocumentApi(id) for owner-level delete.
 */

import type {
  CreateUploadUrlInput,
  Document,
  DocumentListFilter,
  RecordDocumentInput,
  UploadUrlResponse,
} from '@/core/schemas/document';

class DocumentsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'DocumentsApiError';
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string };
  } | null;
  if (!res.ok || !json || !('data' in json) || json.data === undefined) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    throw new DocumentsApiError(msg, res.status);
  }
  return json.data as T;
}

export async function requestUploadUrl(input: CreateUploadUrlInput): Promise<UploadUrlResponse> {
  const res = await fetch('/api/documents/upload-url', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap<UploadUrlResponse>(res);
}

export async function recordDocumentApi(
  input: RecordDocumentInput,
): Promise<{ document: Document }> {
  const res = await fetch('/api/documents', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap<{ document: Document }>(res);
}

export async function listDocumentsApi(
  filter?: Partial<DocumentListFilter>,
): Promise<{ documents: Document[] }> {
  const qs = buildListQuery(filter);
  const res = await fetch(`/api/documents${qs}`, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  return unwrap<{ documents: Document[] }>(res);
}

export async function deleteDocumentApi(id: string): Promise<{ id: string }> {
  const res = await fetch(`/api/documents/${id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  return unwrap<{ id: string }>(res);
}

export async function getDocumentSignedUrl(id: string): Promise<{
  url: string;
  filename: string;
  expires_in_seconds: number;
}> {
  const res = await fetch(`/api/documents/${id}/url`, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  return unwrap<{ url: string; filename: string; expires_in_seconds: number }>(res);
}

/**
 * End-to-end upload helper. Hides the three-step dance from callers.
 * Reports progress 0–100 via the optional `onProgress` callback.
 */
export async function uploadDocument(
  args: {
    file: File;
    title?: string;
    description?: string;
  } & Pick<CreateUploadUrlInput, 'parent' | 'category'>,
  options?: { onProgress?: (pct: number) => void },
): Promise<Document> {
  const upload = await requestUploadUrl({
    parent: args.parent,
    category: args.category,
    filename: args.file.name,
    mime_type: args.file.type as CreateUploadUrlInput['mime_type'],
    size_bytes: args.file.size,
  });

  await putWithProgress(upload.signed_url, args.file, options?.onProgress);

  const recorded = await recordDocumentApi({
    parent: args.parent,
    category: args.category,
    storage_path: upload.storage_path,
    filename: args.file.name,
    mime_type: args.file.type as RecordDocumentInput['mime_type'],
    size_bytes: args.file.size,
    title: args.title,
    description: args.description,
  });

  return recorded.document;
}

function putWithProgress(
  url: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (!onProgress || !e.lengthComputable) return;
      onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new DocumentsApiError(`Upload failed (${xhr.status})`, xhr.status));
    };
    xhr.onerror = () => reject(new DocumentsApiError('Network error during upload', 0));
    xhr.send(file);
  });
}

function buildListQuery(filter?: Partial<DocumentListFilter>): string {
  if (!filter) return '';
  const params = new URLSearchParams();
  if (filter.kind) params.set('kind', filter.kind);
  if (filter.org_id) params.set('org_id', filter.org_id);
  if (filter.property_id) params.set('property_id', filter.property_id);
  if (filter.room_id) params.set('room_id', filter.room_id);
  if (filter.tenancy_id) params.set('tenancy_id', filter.tenancy_id);
  if (filter.compliance_item_id) params.set('compliance_item_id', filter.compliance_item_id);
  if (filter.categories && filter.categories.length > 0) {
    params.set('categories', filter.categories.join(','));
  }
  if (filter.limit) params.set('limit', String(filter.limit));
  if (filter.before) params.set('before', filter.before);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export { DocumentsApiError };
