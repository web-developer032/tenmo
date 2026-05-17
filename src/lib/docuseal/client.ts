import 'server-only';
import { getServerEnv } from '@/lib/env.server';
import { AppError, ErrorCode } from '@/lib/errors';
import type { DocuSealSubmission, DocuSealSubmitterRole } from './types';

/**
 * Hand-rolled DocuSeal REST client.
 *
 * - Lazy: never instantiated at module import (so a dev env without
 *   DocuSeal vars doesn't crash unrelated routes).
 * - Self-hosted: base URL comes from `DOCUSEAL_API_URL`. Auth is a
 *   simple `X-Auth-Token` header with `DOCUSEAL_API_TOKEN`.
 * - Throws `AppError(integration_error)` on non-2xx, with the GC-style
 *   `{ ds_status, ds_error }` details for triage.
 *
 * We deliberately avoid the official SDK; see `types.ts`.
 */

export class DocuSealNotConfiguredError extends AppError {
  constructor() {
    super(
      503,
      ErrorCode.integration_error,
      'DocuSeal is not configured. Set DOCUSEAL_API_URL + DOCUSEAL_API_TOKEN to enable AST e-sign.',
    );
    this.name = 'DocuSealNotConfiguredError';
  }
}

interface DsClientConfig {
  token: string;
  baseUrl: string;
  templateId: string;
}

let cached: DsClientConfig | null = null;

function getConfig(): DsClientConfig {
  if (cached) return cached;
  const env = getServerEnv();
  if (!env.DOCUSEAL_API_URL || !env.DOCUSEAL_API_TOKEN || !env.DOCUSEAL_AST_TEMPLATE_ID) {
    throw new DocuSealNotConfiguredError();
  }
  cached = {
    token: env.DOCUSEAL_API_TOKEN,
    baseUrl: env.DOCUSEAL_API_URL.replace(/\/$/, ''),
    templateId: env.DOCUSEAL_AST_TEMPLATE_ID,
  };
  return cached;
}

interface DsRequestOptions {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
}

async function dsRequest<T>(opts: DsRequestOptions): Promise<T> {
  const cfg = getConfig();
  const headers: Record<string, string> = {
    'X-Auth-Token': cfg.token,
    Accept: 'application/json',
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${cfg.baseUrl}${opts.path}`;
  const res = await fetch(url, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new AppError(
      502,
      ErrorCode.integration_error,
      `DocuSeal returned non-JSON (status ${res.status})`,
      { body: text.slice(0, 500) },
    );
  }

  if (!res.ok) {
    const error = (json as { error?: string; message?: string }) ?? {};
    throw new AppError(
      res.status >= 500 ? 502 : res.status,
      ErrorCode.integration_error,
      `DocuSeal: ${error.error ?? error.message ?? `request failed (${res.status})`}`,
      {
        ds_status: res.status,
        ds_error: error,
        path: opts.path,
      },
    );
  }

  return json as T;
}

// ============================================================================
// Submissions
// ============================================================================

/** Each submitter we ask DocuSeal to invite for this AST. */
export interface CreateSubmissionSubmitter {
  email: string;
  name?: string | null;
  role: DocuSealSubmitterRole;
}

export interface CreateSubmissionInput {
  /** Pre-filled values mapped to template fields. The template must
   * have matching field names in the DocuSeal admin UI. */
  values?: Record<string, string | number | null>;
  submitters: CreateSubmissionSubmitter[];
  /** Pass-through metadata, mirrored back on every webhook event. */
  metadata?: Record<string, string>;
  /** ISO date — DocuSeal closes the envelope after this. */
  expire_at?: string;
}

export async function createAstSubmission(
  input: CreateSubmissionInput,
): Promise<DocuSealSubmission> {
  const cfg = getConfig();
  return dsRequest<DocuSealSubmission>({
    method: 'POST',
    path: '/api/submissions',
    body: {
      template_id: cfg.templateId,
      send_email: true,
      submitters: input.submitters,
      values: input.values,
      metadata: input.metadata,
      expire_at: input.expire_at,
    },
  });
}

export async function getSubmission(submissionId: string): Promise<DocuSealSubmission> {
  return dsRequest<DocuSealSubmission>({
    method: 'GET',
    path: `/api/submissions/${encodeURIComponent(submissionId)}`,
  });
}

export async function cancelSubmission(submissionId: string): Promise<void> {
  await dsRequest<unknown>({
    method: 'DELETE',
    path: `/api/submissions/${encodeURIComponent(submissionId)}`,
  });
}

/** Test hook — clear the cached config. */
export function _resetDocuSealClientForTests(): void {
  cached = null;
}
