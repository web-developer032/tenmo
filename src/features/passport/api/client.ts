import type { GeneratePassportInput, PassportData } from '@/core/schemas/passport';

/**
 * Browser-side API client for the Rental Passport feature.
 */

export class PassportApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'PassportApiError';
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string; code?: string };
  } | null;
  if (!res.ok || !json || !('data' in json) || json.data === undefined) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    throw new PassportApiError(msg, res.status, json?.error?.code);
  }
  return json.data as T;
}

export async function getPassportApi(): Promise<PassportData> {
  const res = await fetch('/api/passport', { credentials: 'same-origin' });
  return unwrap<PassportData>(res);
}

export interface GeneratePassportResponse {
  export_id: string;
  download_url: string;
  expires_in_seconds: number;
}

export async function generatePassportApi(
  input: GeneratePassportInput = {},
): Promise<GeneratePassportResponse> {
  const res = await fetch('/api/passport/pdf', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap<GeneratePassportResponse>(res);
}
