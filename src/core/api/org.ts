import type { Org, OrgCreate, OrgUpdate } from '../schemas/org';
import { http } from './http';

/**
 * Org endpoints — all hit Next.js Route Handlers, never the DB directly,
 * because creating an org also creates a membership and audit row.
 */

export const orgApi = {
  list: () => http.get<Org[]>('/api/orgs'),
  detail: (orgId: string) => http.get<Org>(`/api/orgs/${orgId}`),
  bySlug: (slug: string) => http.get<Org>(`/api/orgs/by-slug/${slug}`),
  create: (input: OrgCreate, idempotencyKey?: string) =>
    http.post<Org>('/api/orgs', input, { idempotencyKey }),
  update: (orgId: string, input: OrgUpdate) => http.patch<Org>(`/api/orgs/${orgId}`, input),
};
