import { type ApiResponse, HttpError, NetworkError } from './errors';

/**
 * Minimal fetch wrapper — used by every endpoint function in `core/api/`.
 *
 * Features:
 * - Consistent error parsing into `HttpError` / `NetworkError`.
 * - JSON serialisation.
 * - Optional idempotency-key header for mutating requests.
 *
 * The wrapper intentionally has no platform-specific code so it works in Node,
 * the browser, and React Native.
 */
export type HttpOptions = {
  baseUrl?: string;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type HttpClient = {
  get: <T>(path: string, opts?: HttpOptions) => Promise<T>;
  post: <T>(path: string, body?: unknown, opts?: HttpOptions) => Promise<T>;
  patch: <T>(path: string, body?: unknown, opts?: HttpOptions) => Promise<T>;
  delete: <T>(path: string, opts?: HttpOptions) => Promise<T>;
};

const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

async function request<T>(
  method: string,
  path: string,
  body: unknown,
  opts: HttpOptions = {},
): Promise<T> {
  const url = opts.baseUrl ? `${opts.baseUrl}${path}` : path;
  const init: RequestInit = {
    method,
    headers: {
      ...JSON_HEADERS,
      ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
      ...opts.headers,
    },
    signal: opts.signal,
    credentials: 'include',
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (cause) {
    throw new NetworkError('Network request failed', cause);
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new HttpError(res.status, {
        code: 'invalid_response',
        message: `Server returned non-JSON ${res.status} response`,
      });
    }
  }

  if (!res.ok) {
    const envelope = (parsed as ApiResponse<unknown>) ?? null;
    if (envelope && 'error' in envelope) {
      throw new HttpError(res.status, envelope.error);
    }
    throw new HttpError(res.status, {
      code: 'http_error',
      message: `Request failed with status ${res.status}`,
      details: parsed,
    });
  }

  const envelope = parsed as ApiResponse<T>;
  if (envelope && 'data' in envelope) {
    return envelope.data;
  }
  return parsed as T;
}

export const http: HttpClient = {
  get: (path, opts) => request('GET', path, undefined, opts),
  post: (path, body, opts) => request('POST', path, body, opts),
  patch: (path, body, opts) => request('PATCH', path, body, opts),
  delete: (path, opts) => request('DELETE', path, undefined, opts),
};
