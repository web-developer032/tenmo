/**
 * Listings + applications domain — Phase Q.
 *
 * Source of truth for the database enums `listing_status` and
 * `application_status` (see migration `20260504000000_listings_and_applications.sql`).
 *
 * The constants here are the cross-import surface for the rest of the app:
 *
 *   - core/schemas/listing.ts and core/schemas/application.ts derive their
 *     Zod enums from this module so we never end up with a stale duplicate.
 *   - The UI uses `LISTING_STATUS_LABEL` / `APPLICATION_STATUS_TONE` so badge
 *     copy and badge tones stay consistent across landlord, tenant, and
 *     admin surfaces.
 */

export type ListingStatus = 'draft' | 'published' | 'paused' | 'closed';

export const LISTING_STATUS_VALUES: readonly ListingStatus[] = [
  'draft',
  'published',
  'paused',
  'closed',
] as const;

/** Short human-readable labels for the listings manager UI. */
export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  paused: 'Paused',
  closed: 'Closed',
};

/** Tones map to the existing badge variants (info/warn/success/muted). */
export const LISTING_STATUS_TONE: Record<ListingStatus, 'muted' | 'success' | 'warn' | 'danger'> = {
  draft: 'muted',
  published: 'success',
  paused: 'warn',
  closed: 'danger',
};

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export const APPLICATION_STATUS_VALUES: readonly ApplicationStatus[] = [
  'pending',
  'accepted',
  'rejected',
  'withdrawn',
] as const;

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const APPLICATION_STATUS_TONE: Record<
  ApplicationStatus,
  'muted' | 'success' | 'warn' | 'danger'
> = {
  pending: 'warn',
  accepted: 'success',
  rejected: 'danger',
  withdrawn: 'muted',
};

/** Boilerplate decline reason set by the auto-reject sibling trigger. */
export const APPLICATION_DECLINE_REASON_ROOM_FILLED = 'room_filled';

/** Public listings page defaults. */
export const LISTING_SEARCH_PAGE_SIZE = 24;
export const LISTING_SEARCH_MAX_PAGE_SIZE = 60;

/** Tenant "my applications" page size. */
export const TENANT_APPLICATIONS_PAGE_SIZE = 20;
