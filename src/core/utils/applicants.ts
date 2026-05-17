import type { ApplicationStatus } from '../constants/listings';

/**
 * Pure helpers for working with the applicant queue.
 *
 * Kept side-effect-free + pure so they can be unit-tested without a
 * Supabase client or the request layer.
 */

export type ApplicantStatusCounts = Record<ApplicationStatus, number>;

export const ZERO_COUNTS: ApplicantStatusCounts = {
  pending: 0,
  accepted: 0,
  rejected: 0,
  withdrawn: 0,
};

interface ApplicantRow {
  status: ApplicationStatus | string;
}

/**
 * Reduce a list of application rows into a `{ pending, accepted, rejected,
 * withdrawn }` count object. Unknown status strings are ignored — the DB
 * enum protects us, but defensive parsing keeps the badge UI from crashing
 * in mixed-version deploys.
 */
export function summariseApplicants(rows: readonly ApplicantRow[]): ApplicantStatusCounts {
  const counts: ApplicantStatusCounts = { ...ZERO_COUNTS };
  for (const row of rows) {
    const key = row.status as ApplicationStatus;
    if (key in counts) {
      counts[key] += 1;
    }
  }
  return counts;
}

/** Returns the total non-withdrawn application count for a "{N} applicants" badge. */
export function activeApplicantCount(counts: ApplicantStatusCounts): number {
  return counts.pending + counts.accepted + counts.rejected;
}

/**
 * UI helper: which applicants should be shown highlighted in the queue.
 *
 *  - The accepted applicant (at most one) is always pinned to the top.
 *  - Pending applicants are next, oldest first.
 *  - Rejected and withdrawn rows go to the bottom in their original order.
 *
 * The function is stable — equal-status rows keep their input order so the
 * landlord sees applicants in arrival order within each bucket.
 */
export function sortApplicantsForLandlordQueue<T extends ApplicantRow & { applied_at: string }>(
  rows: readonly T[],
): T[] {
  const buckets: Record<'accepted' | 'pending' | 'other', T[]> = {
    accepted: [],
    pending: [],
    other: [],
  };
  for (const row of rows) {
    if (row.status === 'accepted') buckets.accepted.push(row);
    else if (row.status === 'pending') buckets.pending.push(row);
    else buckets.other.push(row);
  }
  buckets.pending.sort((a, b) => (a.applied_at < b.applied_at ? -1 : 1));
  buckets.other.sort((a, b) => (a.applied_at > b.applied_at ? -1 : 1));
  return [...buckets.accepted, ...buckets.pending, ...buckets.other];
}
