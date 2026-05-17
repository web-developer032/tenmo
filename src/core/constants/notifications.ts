/**
 * Notification domain — kinds, default channels, criticality.
 *
 * Source of truth for the database enum `notification_kind` (see migration
 * `20260101001200_notifications.sql`) and the user-facing preferences UI.
 *
 * Adding a new kind?
 *  1. Add it to the `NotificationKind` union below.
 *  2. Add it to the migration enum (new migration; never edit applied
 *     migrations).
 *  3. Add an entry to `NOTIFICATION_KIND_RULES` with sensible defaults.
 *  4. Update the publish helper if the new kind needs special routing.
 */

export type NotificationKind =
  | 'compliance_due'
  | 'compliance_overdue'
  | 'compliance_doc_uploaded'
  | 'rent_charged'
  | 'rent_paid'
  | 'rent_failed'
  | 'bill_added'
  | 'mandate_active'
  | 'mandate_failed'
  | 'passport_exported'
  | 'ast_sent'
  | 'ast_signed'
  | 'ast_expired'
  | 'ast_declined'
  | 'ticket_created'
  | 'ticket_message'
  | 'ticket_status_changed'
  | 'ticket_assigned'
  | 'tenancy_invited'
  | 'tenancy_accepted'
  | 'tenancy_ended'
  | 'tenancy_doc_uploaded'
  | 'message_received'
  | 'subscription_past_due'
  | 'listing_published'
  | 'application_received'
  | 'application_accepted'
  | 'application_rejected'
  | 'application_withdrawn'
  | 'system';

/** Coarse grouping shown in the preferences UI. */
export type NotificationGroup =
  | 'compliance'
  | 'rent'
  | 'tickets'
  | 'tenancies'
  | 'messages'
  | 'billing'
  | 'documents'
  | 'listings'
  | 'system';

export type NotificationKindRule = {
  kind: NotificationKind;
  group: NotificationGroup;
  /** Short human label for the preferences UI. */
  label: string;
  /** One-line description shown next to the toggle. */
  description: string;
  /**
   * Defaults applied when the user has no explicit preference. In-app is
   * always-on for audit-trail reasons; the user can mute the email.
   */
  defaults: {
    in_app: true;
    email: boolean;
  };
  /**
   * Critical notifications cannot have email turned off entirely — the
   * preferences UI shows them as "always on". This matches the doc:
   *   docs/07-flows/12-notifications.md#categories.
   */
  critical: boolean;
};

export const NOTIFICATION_KIND_RULES: Record<NotificationKind, NotificationKindRule> = {
  compliance_due: {
    kind: 'compliance_due',
    group: 'compliance',
    label: 'Compliance — upcoming',
    description: 'Heads-up when a certificate is approaching its expiry (60d / 30d / 7d).',
    defaults: { in_app: true, email: true },
    critical: false,
  },
  compliance_overdue: {
    kind: 'compliance_overdue',
    group: 'compliance',
    label: 'Compliance — overdue',
    description: "A certificate has expired and you're now non-compliant. Always emailed.",
    defaults: { in_app: true, email: true },
    critical: true,
  },
  compliance_doc_uploaded: {
    kind: 'compliance_doc_uploaded',
    group: 'documents',
    label: 'Compliance — new document',
    description: 'A landlord uploaded a fresh certificate for one of your properties or rooms.',
    defaults: { in_app: true, email: false },
    critical: false,
  },
  rent_charged: {
    kind: 'rent_charged',
    group: 'rent',
    label: 'Rent charged',
    description: 'A new rent charge has been generated for an upcoming period.',
    defaults: { in_app: true, email: false },
    critical: false,
  },
  rent_paid: {
    kind: 'rent_paid',
    group: 'rent',
    label: 'Rent paid',
    description: 'A payment was confirmed against an outstanding rent charge.',
    defaults: { in_app: true, email: false },
    critical: false,
  },
  rent_failed: {
    kind: 'rent_failed',
    group: 'rent',
    label: 'Rent failed',
    description: 'A direct debit collection failed and needs follow-up.',
    defaults: { in_app: true, email: true },
    critical: true,
  },
  bill_added: {
    kind: 'bill_added',
    group: 'rent',
    label: 'New shared bill',
    description: 'A landlord added a new utility bill — your share is shown in your bills page.',
    defaults: { in_app: true, email: false },
    critical: false,
  },
  mandate_active: {
    kind: 'mandate_active',
    group: 'rent',
    label: 'Direct Debit active',
    description:
      'A tenant has set up a Direct Debit mandate. Future rent will collect automatically.',
    defaults: { in_app: true, email: true },
    critical: false,
  },
  mandate_failed: {
    kind: 'mandate_failed',
    group: 'rent',
    label: 'Direct Debit problem',
    description: 'A Direct Debit mandate has failed or been cancelled and needs attention.',
    defaults: { in_app: true, email: true },
    critical: true,
  },
  passport_exported: {
    kind: 'passport_exported',
    group: 'system',
    label: 'Rental Passport exported',
    description: 'You generated a Rental Passport PDF — keep this receipt for your records.',
    defaults: { in_app: true, email: false },
    critical: false,
  },
  ast_sent: {
    kind: 'ast_sent',
    group: 'tenancies',
    label: 'AST sent for signing',
    description: 'A tenancy agreement has been sent for both parties to sign.',
    defaults: { in_app: true, email: true },
    critical: true,
  },
  ast_signed: {
    kind: 'ast_signed',
    group: 'tenancies',
    label: 'AST signed',
    description: 'Both parties have signed the tenancy agreement.',
    defaults: { in_app: true, email: true },
    critical: true,
  },
  ast_declined: {
    kind: 'ast_declined',
    group: 'tenancies',
    label: 'AST declined',
    description: 'A tenancy agreement was declined and needs to be revised.',
    defaults: { in_app: true, email: true },
    critical: true,
  },
  ast_expired: {
    kind: 'ast_expired',
    group: 'tenancies',
    label: 'AST expired',
    description: 'A tenancy agreement expired before both parties signed.',
    defaults: { in_app: true, email: true },
    critical: false,
  },
  ticket_created: {
    kind: 'ticket_created',
    group: 'tickets',
    label: 'Maintenance — new ticket',
    description: 'Sent to landlord/staff when a tenant raises an issue.',
    defaults: { in_app: true, email: true },
    critical: true,
  },
  ticket_message: {
    kind: 'ticket_message',
    group: 'tickets',
    label: 'Maintenance — replies',
    description: 'New replies on tickets you are part of.',
    defaults: { in_app: true, email: true },
    critical: false,
  },
  ticket_status_changed: {
    kind: 'ticket_status_changed',
    group: 'tickets',
    label: 'Maintenance — status changes',
    description: 'When a ticket moves to a new state (in progress, resolved …).',
    defaults: { in_app: true, email: true },
    critical: false,
  },
  ticket_assigned: {
    kind: 'ticket_assigned',
    group: 'tickets',
    label: 'Maintenance — assigned to you',
    description: 'When a ticket is assigned to you or a contractor on your behalf.',
    defaults: { in_app: true, email: true },
    critical: false,
  },
  tenancy_invited: {
    kind: 'tenancy_invited',
    group: 'tenancies',
    label: 'Tenancy invite sent / received',
    description: 'When you send or receive a tenancy invitation.',
    defaults: { in_app: true, email: true },
    critical: true,
  },
  tenancy_accepted: {
    kind: 'tenancy_accepted',
    group: 'tenancies',
    label: 'Tenancy accepted',
    description: 'When a tenant accepts a tenancy invitation.',
    defaults: { in_app: true, email: true },
    critical: true,
  },
  tenancy_ended: {
    kind: 'tenancy_ended',
    group: 'tenancies',
    label: 'Tenancy ended',
    description: 'When a tenancy is ended early or runs to its term end.',
    defaults: { in_app: true, email: true },
    critical: false,
  },
  tenancy_doc_uploaded: {
    kind: 'tenancy_doc_uploaded',
    group: 'documents',
    label: 'Tenancy — new document',
    description:
      'A tenancy document (AST, prescribed information, inventory) was added to your tenancy.',
    defaults: { in_app: true, email: true },
    critical: false,
  },
  message_received: {
    kind: 'message_received',
    group: 'messages',
    label: 'Direct messages',
    description: 'New replies in your tenant ↔ landlord conversations.',
    defaults: { in_app: true, email: false },
    critical: false,
  },
  subscription_past_due: {
    kind: 'subscription_past_due',
    group: 'billing',
    label: 'Subscription past due',
    description: 'When your Stripe subscription invoice fails to pay.',
    defaults: { in_app: true, email: true },
    critical: true,
  },
  listing_published: {
    kind: 'listing_published',
    group: 'listings',
    label: 'Room listed',
    description: 'A room you manage is now published on the public listings page.',
    defaults: { in_app: true, email: false },
    critical: false,
  },
  application_received: {
    kind: 'application_received',
    group: 'listings',
    label: 'New application received',
    description: 'A tenant applied for a room you have listed.',
    defaults: { in_app: true, email: true },
    critical: false,
  },
  application_accepted: {
    kind: 'application_accepted',
    group: 'listings',
    label: 'Application accepted',
    description: 'The landlord accepted your application — check your invite to continue.',
    defaults: { in_app: true, email: true },
    critical: true,
  },
  application_rejected: {
    kind: 'application_rejected',
    group: 'listings',
    label: 'Application not selected',
    description: 'The landlord chose another applicant — keep browsing similar rooms.',
    defaults: { in_app: true, email: true },
    critical: false,
  },
  application_withdrawn: {
    kind: 'application_withdrawn',
    group: 'listings',
    label: 'Application withdrawn',
    description: 'An applicant withdrew their interest in a room you have listed.',
    defaults: { in_app: true, email: false },
    critical: false,
  },
  system: {
    kind: 'system',
    group: 'system',
    label: 'System announcements',
    description: 'Maintenance windows, policy updates, security notices.',
    defaults: { in_app: true, email: false },
    critical: false,
  },
};

export const NOTIFICATION_KIND_VALUES: NotificationKind[] = Object.keys(
  NOTIFICATION_KIND_RULES,
) as NotificationKind[];

export const NOTIFICATION_GROUP_LABEL: Record<NotificationGroup, string> = {
  compliance: 'Compliance',
  rent: 'Rent',
  tickets: 'Maintenance',
  tenancies: 'Tenancies',
  messages: 'Messages',
  billing: 'Billing',
  documents: 'Documents',
  listings: 'Listings & applications',
  system: 'System',
};

/** UI defaults for paginating the bell + full feed. */
export const NOTIFICATION_BELL_LIMIT = 10;
export const NOTIFICATION_PAGE_SIZE = 25;
