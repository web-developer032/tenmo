/**
 * Summary helpers for the rebuilt tenant `/tenant/tickets` page.
 *
 * Pure functions (no Supabase / DOM / Next imports) so they're trivially
 * unit-testable and reusable in both server components and the future
 * realtime client view.
 */

import type { TicketStatus } from '@/core/constants/tickets';
import type { Ticket } from '@/core/schemas/ticket';

export type TenantTicketSummary = {
  total: number;
  /** Currently open + in-progress + awaiting tickets. */
  openCount: number;
  inProgressCount: number;
  resolvedCount: number;
  cancelledCount: number;
  /** Mean number of days between `created_at` and `resolved_at`, or null. */
  avgResolutionDays: number | null;
  /** 1–5 star derivation from `avgResolutionDays`. */
  landlordResponseStars: number;
};

const OPEN_STATUSES = new Set<TicketStatus>(['open', 'triaged']);
const IN_PROGRESS_STATUSES = new Set<TicketStatus>([
  'in_progress',
  'awaiting_tenant',
  'awaiting_contractor',
]);
const RESOLVED_STATUSES = new Set<TicketStatus>(['resolved', 'closed']);

export function summariseTenantTickets(
  tickets: Pick<Ticket, 'status' | 'created_at' | 'resolved_at'>[],
): TenantTicketSummary {
  let openCount = 0;
  let inProgressCount = 0;
  let resolvedCount = 0;
  let cancelledCount = 0;
  const resolutionDays: number[] = [];

  for (const t of tickets) {
    if (OPEN_STATUSES.has(t.status)) openCount += 1;
    else if (IN_PROGRESS_STATUSES.has(t.status)) inProgressCount += 1;
    else if (RESOLVED_STATUSES.has(t.status)) {
      resolvedCount += 1;
      if (t.resolved_at) {
        const days = daysBetween(t.created_at, t.resolved_at);
        if (days >= 0 && Number.isFinite(days)) resolutionDays.push(days);
      }
    } else if (t.status === 'cancelled') {
      cancelledCount += 1;
    }
  }

  const avgResolutionDays =
    resolutionDays.length === 0
      ? null
      : Math.max(1, Math.round(resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length));

  return {
    total: tickets.length,
    openCount,
    inProgressCount,
    resolvedCount,
    cancelledCount,
    avgResolutionDays,
    landlordResponseStars: avgResolutionDays == null ? 0 : starsFromDays(avgResolutionDays),
  };
}

/**
 * Heuristic 1–5 ★ rating from average resolution days.
 *   ≤ 2 days → 5 ★
 *   ≤ 4 days → 4 ★
 *   ≤ 7 days → 3 ★
 *   ≤ 14 days → 2 ★
 *   else     → 1 ★
 *
 * Replaceable when a true tenant-rating system lands.
 */
export function starsFromDays(days: number): number {
  if (days <= 2) return 5;
  if (days <= 4) return 4;
  if (days <= 7) return 3;
  if (days <= 14) return 2;
  return 1;
}

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  return Math.round((b - a) / 86_400_000);
}
