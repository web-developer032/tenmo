import type { AstEnvelope } from '@/core/schemas/ast';

/**
 * Browser API client for the AST domain. Calls our routes only —
 * never the DocuSeal API directly.
 */

export class AstApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AstApiError';
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string; code?: string; details?: unknown };
  } | null;
  if (!res.ok || !json || !('data' in json) || json.data === undefined) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    throw new AstApiError(msg, res.status, json?.error?.code, json?.error?.details);
  }
  return json.data as T;
}

export async function startEnvelopeApi(input: { tenancy_id: string }): Promise<AstEnvelope> {
  const res = await fetch('/api/ast/envelopes', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap(res);
}

export async function getEnvelopeApi(envelopeId: string): Promise<AstEnvelope> {
  const res = await fetch(`/api/ast/envelopes/${encodeURIComponent(envelopeId)}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  return unwrap(res);
}

export async function cancelEnvelopeApi(envelopeId: string): Promise<AstEnvelope> {
  const res = await fetch(`/api/ast/envelopes/${encodeURIComponent(envelopeId)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  return unwrap(res);
}
