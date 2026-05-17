/**
 * Centralised analytics event taxonomy. Keep this list small and
 * curated — every event added here ends up in PostHog forever.
 *
 * Naming: `domain.thing_done` (snake_case). Verbs in past tense.
 *
 * Values are intentionally string literals so we can grep for
 * usage and so the PostHog Insights UI doesn't get a
 * `[object Object]` if someone forgets a `.toString()`.
 */

export const AnalyticsEvent = {
  // Auth
  auth_signed_in: 'auth.signed_in',
  auth_signed_out: 'auth.signed_out',
  auth_signed_up: 'auth.signed_up',

  // Onboarding
  onboarding_org_created: 'onboarding.org_created',

  // Landlord
  property_created: 'landlord.property_created',
  room_created: 'landlord.room_created',
  tenancy_created: 'landlord.tenancy_created',
  bill_created: 'landlord.bill_created',

  // Tenant
  tenancy_accepted: 'tenant.tenancy_accepted',
  passport_exported: 'tenant.passport_exported',
  ticket_raised: 'tenant.ticket_raised',
  mandate_authorised: 'tenant.mandate_authorised',

  // Billing
  subscription_started: 'billing.subscription_started',
  subscription_canceled: 'billing.subscription_canceled',
  subscription_override_set: 'billing.subscription_override_set',

  // Compliance
  compliance_reminder_sent: 'compliance.reminder_sent',

  // Admin
  admin_console_viewed: 'admin.console_viewed',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];
