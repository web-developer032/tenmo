/**
 * Shared types for the role-switcher feature.
 * These are intentionally tiny; the full Org/OrgMembership shapes live in core/.
 */
export type OrgSummary = {
  id: string;
  slug: string;
  name: string;
  role: 'owner' | 'agent' | 'staff';
};

export type RoleAvailability = {
  orgs: ReadonlyArray<OrgSummary>;
  hasTenancies: boolean;
  isAdmin: boolean;
};
