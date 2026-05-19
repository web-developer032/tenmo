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
  | 'impersonation_end'
  | 'landlord_invited'
  | 'landlord_suspended'
  | 'landlord_reinstated'
  | 'admin_invited'
  | 'admin_role_changed'
  | 'admin_revoked'
  | 'billing_retry'
  | 'billing_reminder_sent'
  | 'support_ticket_assigned'
  | 'support_ticket_resolved'
  | 'compliance_alert_sent'
  | 'platform_settings_updated';

export const ADMIN_EVENT_KIND_VALUES: AdminEventKind[] = [
  'user_viewed',
  'org_viewed',
  'subscription_override_set',
  'subscription_override_cleared',
  'support_note',
  'impersonation_start',
  'impersonation_end',
  'landlord_invited',
  'landlord_suspended',
  'landlord_reinstated',
  'admin_invited',
  'admin_role_changed',
  'admin_revoked',
  'billing_retry',
  'billing_reminder_sent',
  'support_ticket_assigned',
  'support_ticket_resolved',
  'compliance_alert_sent',
  'platform_settings_updated',
];

export const ADMIN_EVENT_LABEL: Record<AdminEventKind, string> = {
  user_viewed: 'Viewed user',
  org_viewed: 'Viewed organisation',
  subscription_override_set: 'Subscription override set',
  subscription_override_cleared: 'Subscription override cleared',
  support_note: 'Support note',
  impersonation_start: 'Impersonation started',
  impersonation_end: 'Impersonation ended',
  landlord_invited: 'Landlord invited',
  landlord_suspended: 'Landlord suspended',
  landlord_reinstated: 'Landlord reinstated',
  admin_invited: 'Admin invited',
  admin_role_changed: 'Admin role changed',
  admin_revoked: 'Admin revoked',
  billing_retry: 'Billing retry',
  billing_reminder_sent: 'Billing reminder sent',
  support_ticket_assigned: 'Support ticket assigned',
  support_ticket_resolved: 'Support ticket resolved',
  compliance_alert_sent: 'Compliance alert sent',
  platform_settings_updated: 'Platform settings updated',
};

export const ADMIN_EVENT_TONE: Record<AdminEventKind, string> = {
  user_viewed: 'bg-sand text-ink-mid',
  org_viewed: 'bg-sand text-ink-mid',
  subscription_override_set: 'bg-amber-bg text-amber',
  subscription_override_cleared: 'bg-sand text-ink-mid',
  support_note: 'bg-blue-bg text-blue',
  impersonation_start: 'bg-alert-bg text-alert',
  impersonation_end: 'bg-sand text-ink-mid',
  landlord_invited: 'bg-foam text-forest-700',
  landlord_suspended: 'bg-alert-bg text-alert',
  landlord_reinstated: 'bg-foam text-forest-700',
  admin_invited: 'bg-blue-bg text-blue',
  admin_role_changed: 'bg-amber-bg text-amber',
  admin_revoked: 'bg-alert-bg text-alert',
  billing_retry: 'bg-blue-bg text-blue',
  billing_reminder_sent: 'bg-foam text-forest-700',
  support_ticket_assigned: 'bg-blue-bg text-blue',
  support_ticket_resolved: 'bg-foam text-forest-700',
  compliance_alert_sent: 'bg-amber-bg text-amber',
  platform_settings_updated: 'bg-purple-bg text-purple',
};

/** Default page size for admin list views. Trades scroll length
 * against round-trips. */
export const ADMIN_LIST_PAGE_SIZE = 25;
/** Hard upper bound to stop a malicious `?per_page=999999` from
 * tipping the server over. */
export const ADMIN_LIST_MAX_PAGE_SIZE = 100;
