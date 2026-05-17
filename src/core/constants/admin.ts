/**
 * Admin domain — event kinds, labels, and tones.
 *
 * Source of truth for the Postgres enum `admin_event_kind` (see
 * migration `20260101002200_admin_audit_log.sql`). Keep in sync.
 */

export type AdminEventKind =
  | 'user_viewed'
  | 'org_viewed'
  | 'subscription_override_set'
  | 'subscription_override_cleared'
  | 'support_note'
  | 'impersonation_start'
  | 'impersonation_end';

export const ADMIN_EVENT_KIND_VALUES: AdminEventKind[] = [
  'user_viewed',
  'org_viewed',
  'subscription_override_set',
  'subscription_override_cleared',
  'support_note',
  'impersonation_start',
  'impersonation_end',
];

export const ADMIN_EVENT_LABEL: Record<AdminEventKind, string> = {
  user_viewed: 'Viewed user',
  org_viewed: 'Viewed organisation',
  subscription_override_set: 'Subscription override set',
  subscription_override_cleared: 'Subscription override cleared',
  support_note: 'Support note',
  impersonation_start: 'Impersonation started',
  impersonation_end: 'Impersonation ended',
};

export const ADMIN_EVENT_TONE: Record<AdminEventKind, string> = {
  user_viewed: 'bg-muted text-muted-foreground',
  org_viewed: 'bg-muted text-muted-foreground',
  subscription_override_set: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  subscription_override_cleared: 'bg-muted text-muted-foreground',
  support_note: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  impersonation_start: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  impersonation_end: 'bg-muted text-muted-foreground',
};

/** Default page size for admin list views. Trades scroll length
 * against round-trips. */
export const ADMIN_LIST_PAGE_SIZE = 25;
/** Hard upper bound to stop a malicious `?per_page=999999` from
 * tipping the server over. */
export const ADMIN_LIST_MAX_PAGE_SIZE = 100;
