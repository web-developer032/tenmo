/**
 * Browser API client for `/api/profile`.
 *
 * Mirrors `features/notifications/api/client.ts` so client components
 * never hard-code URL strings or hand-unwrap our `{ data, error }`
 * envelope.
 */

import type { ProfileEditInput } from '@/core/schemas/profile';
import type { CurrentProfile } from '../loaders';

class ProfileApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ProfileApiError';
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string };
  } | null;
  if (!res.ok || !json || !('data' in json) || json.data === undefined) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    throw new ProfileApiError(msg, res.status);
  }
  return json.data as T;
}

export async function fetchProfile(): Promise<CurrentProfile> {
  const res = await fetch('/api/profile', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  return unwrap<CurrentProfile>(res);
}

export async function updateProfileApi(patch: ProfileEditInput): Promise<CurrentProfile> {
  const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(patch),
  });
  return unwrap<CurrentProfile>(res);
}

export { ProfileApiError };
