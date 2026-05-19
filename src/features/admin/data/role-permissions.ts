import type { AdminRole } from '@/features/admin/server';

/**
 * Static description of what each admin role can do. Stored in code
 * (not the DB) so this stays a deliberate design decision instead of
 * something an admin can accidentally widen via the UI.
 *
 * `true` = the role can perform the action. `false` = blocked.
 * Pages that only inspect can show a chip; pages that mutate use the
 * matching server-side `assertAdminRole(...)` helper.
 */

export type PermissionId =
  | 'view_dashboard'
  | 'view_billing'
  | 'edit_billing'
  | 'view_support'
  | 'edit_support'
  | 'view_compliance'
  | 'edit_compliance'
  | 'view_audit'
  | 'view_users'
  | 'edit_admins'
  | 'edit_settings'
  | 'impersonate';

export type PermissionRow = {
  id: PermissionId;
  label: string;
  area: 'Overview' | 'Business' | 'Platform' | 'Users';
};

export const PERMISSIONS: PermissionRow[] = [
  { id: 'view_dashboard', label: 'View platform dashboard', area: 'Overview' },
  { id: 'view_billing', label: 'View subscriptions & billing', area: 'Business' },
  { id: 'edit_billing', label: 'Retry payments, send reminders', area: 'Business' },
  { id: 'view_support', label: 'View support tickets', area: 'Business' },
  { id: 'edit_support', label: 'Assign / resolve support tickets', area: 'Business' },
  { id: 'view_compliance', label: 'View compliance alerts', area: 'Business' },
  { id: 'edit_compliance', label: 'Notify landlords of compliance', area: 'Business' },
  { id: 'view_audit', label: 'View audit log', area: 'Platform' },
  { id: 'view_users', label: 'View landlords, tenants, profiles', area: 'Users' },
  { id: 'edit_admins', label: 'Invite or revoke admins', area: 'Platform' },
  { id: 'edit_settings', label: 'Edit platform settings', area: 'Platform' },
  { id: 'impersonate', label: 'Impersonate landlords / tenants', area: 'Users' },
];

export const ROLE_PERMISSIONS: Record<AdminRole, Record<PermissionId, boolean>> = {
  super: {
    view_dashboard: true,
    view_billing: true,
    edit_billing: true,
    view_support: true,
    edit_support: true,
    view_compliance: true,
    edit_compliance: true,
    view_audit: true,
    view_users: true,
    edit_admins: true,
    edit_settings: true,
    impersonate: true,
  },
  support: {
    view_dashboard: true,
    view_billing: false,
    edit_billing: false,
    view_support: true,
    edit_support: true,
    view_compliance: true,
    edit_compliance: true,
    view_audit: true,
    view_users: true,
    edit_admins: false,
    edit_settings: false,
    impersonate: true,
  },
  finance: {
    view_dashboard: true,
    view_billing: true,
    edit_billing: true,
    view_support: true,
    edit_support: false,
    view_compliance: false,
    edit_compliance: false,
    view_audit: true,
    view_users: true,
    edit_admins: false,
    edit_settings: false,
    impersonate: false,
  },
  readonly: {
    view_dashboard: true,
    view_billing: true,
    edit_billing: false,
    view_support: true,
    edit_support: false,
    view_compliance: true,
    edit_compliance: false,
    view_audit: true,
    view_users: true,
    edit_admins: false,
    edit_settings: false,
    impersonate: false,
  },
};

export const ROLE_LABEL: Record<AdminRole, string> = {
  super: 'Super admin',
  support: 'Support',
  finance: 'Finance',
  readonly: 'Read-only',
};

export const ROLE_SUB: Record<AdminRole, string> = {
  super: 'Full access',
  support: 'Tickets, compliance, impersonation',
  finance: 'Billing + analytics',
  readonly: 'View only',
};
