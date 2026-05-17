/**
 * Browser API client for notifications.
 *
 * Thin wrapper around `fetch` so client components don't repeat URL strings,
 * envelope unwrapping, or error mapping. Server-side modules import from
 * `features/notifications/server` instead.
 */

import type {
  Notification,
  NotificationListFilter,
  NotificationPreferences,
  NotificationPreferencesPatch,
} from '@/core/schemas/notification';

export type NotificationListResponse = {
  notifications: Notification[];
  unread: { total: number };
};

class NotificationsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'NotificationsApiError';
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string };
  } | null;
  if (!res.ok || !json || !('data' in json) || json.data === undefined) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    throw new NotificationsApiError(msg, res.status);
  }
  return json.data as T;
}

function buildListQuery(filter?: Partial<NotificationListFilter>): string {
  if (!filter) return '';
  const params = new URLSearchParams();
  if (filter.limit) params.set('limit', String(filter.limit));
  if (filter.before) params.set('before', filter.before);
  if (filter.unread_only) params.set('unread_only', '1');
  if (filter.kinds && filter.kinds.length > 0) params.set('kinds', filter.kinds.join(','));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchNotifications(
  filter?: Partial<NotificationListFilter>,
): Promise<NotificationListResponse> {
  const res = await fetch(`/api/notifications${buildListQuery(filter)}`, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  return unwrap<NotificationListResponse>(res);
}

export async function markNotificationsReadApi(ids: string[]): Promise<{ updated: number }> {
  if (ids.length === 0) return { updated: 0 };
  const res = await fetch('/api/notifications/mark-read', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ ids }),
  });
  return unwrap<{ updated: number }>(res);
}

export async function markAllNotificationsReadApi(): Promise<{ updated: number }> {
  const res = await fetch('/api/notifications', {
    method: 'PATCH',
    credentials: 'same-origin',
  });
  return unwrap<{ updated: number }>(res);
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const res = await fetch('/api/notifications/preferences', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  return unwrap<NotificationPreferences>(res);
}

export async function updateNotificationPreferencesApi(
  patch: NotificationPreferencesPatch,
): Promise<NotificationPreferences> {
  const res = await fetch('/api/notifications/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(patch),
  });
  return unwrap<NotificationPreferences>(res);
}

export { NotificationsApiError };
