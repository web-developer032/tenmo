/**
 * Pick the "primary" tenancy for a tenant who may be on more than one
 * tenancy at once (e.g. dual-role personas like Alex).
 *
 *  - Prefer `active` over `awaiting_*` / `pending_invite`.
 *  - Within a status bucket, prefer the most-recently-started tenancy.
 *  - Return `null` if the candidate list is empty.
 *
 * Kept as a pure function so any tenancy-scoped page (Home, Payments,
 * Tickets, Documents, Profile) can share the same selection logic
 * without each route re-implementing it.
 */

import type { TenancyStatus } from '@/core/schemas/tenancy';

export type CandidateTenancy = {
  id: string;
  status: TenancyStatus;
  start_date: string | null;
};

const STATUS_PRIORITY: Record<TenancyStatus, number> = {
  active: 0,
  awaiting_deposit: 1,
  awaiting_signature: 2,
  pending_invite: 3,
  draft: 4,
  ended: 5,
  cancelled: 6,
};

export function pickPrimaryTenancy<T extends CandidateTenancy>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => {
    const sa = STATUS_PRIORITY[a.status] ?? 99;
    const sb = STATUS_PRIORITY[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    const da = a.start_date ? Date.parse(a.start_date) : 0;
    const db = b.start_date ? Date.parse(b.start_date) : 0;
    return db - da;
  });
  return sorted[0] ?? null;
}
