/**
 * Centralised TanStack Query keys — keep this file the single source of truth.
 *
 * Use as: `useQuery({ queryKey: queryKeys.orgs.list(), ... })`
 */

export const queryKeys = {
  profile: {
    me: () => ['profile', 'me'] as const,
  },
  orgs: {
    all: () => ['orgs'] as const,
    list: () => ['orgs', 'list'] as const,
    detail: (orgId: string) => ['orgs', 'detail', orgId] as const,
    bySlug: (slug: string) => ['orgs', 'slug', slug] as const,
    members: (orgId: string) => ['orgs', orgId, 'members'] as const,
  },
  properties: {
    all: () => ['properties'] as const,
    listForOrg: (orgId: string) => ['properties', 'org', orgId] as const,
    detail: (propertyId: string) => ['properties', 'detail', propertyId] as const,
    rooms: (propertyId: string) => ['properties', propertyId, 'rooms'] as const,
  },
  rooms: {
    detail: (roomId: string) => ['rooms', 'detail', roomId] as const,
  },
  tenancies: {
    forOrg: (orgId: string) => ['tenancies', 'org', orgId] as const,
    forUser: () => ['tenancies', 'me'] as const,
    detail: (tenancyId: string) => ['tenancies', 'detail', tenancyId] as const,
  },
  compliance: {
    forOrg: (orgId: string) => ['compliance', 'org', orgId] as const,
    forProperty: (propertyId: string) => ['compliance', 'property', propertyId] as const,
  },
} as const;
