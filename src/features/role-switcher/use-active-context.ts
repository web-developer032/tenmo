'use client';

import { usePathname } from 'next/navigation';
import * as React from 'react';
import type { ActiveContext } from '@/core/schemas/profile';
import { useActiveContextStore } from '@/core/stores/active-context';
import type { OrgSummary } from './types';

/**
 * Derive the active context from the URL pathname.
 *
 * The URL is the source of truth:
 *   - /landlord/[slug]/...  → { kind: 'landlord', orgSlug, orgId }
 *   - /tenant/...           → { kind: 'tenant' }
 *   - /admin/...            → { kind: 'admin' }
 *   - anything else         → null
 *
 * `orgs` is the user's full list of memberships, used to resolve the slug to an
 * orgId. Pass it in once at the layout level (`useActiveContext(orgs)`).
 */
export function useActiveContext(orgs: ReadonlyArray<OrgSummary>): ActiveContext | null {
  const pathname = usePathname();
  const setContext = useActiveContextStore((s) => s.setContext);

  const ctx = React.useMemo<ActiveContext | null>(() => {
    if (!pathname) return null;
    const segments = pathname.split('/').filter(Boolean);
    const head = segments[0];

    if (head === 'landlord') {
      const slug = segments[1];
      if (!slug) return null;
      const org = orgs.find((o) => o.slug === slug);
      if (!org) return null;
      return { kind: 'landlord', orgId: org.id, orgSlug: org.slug };
    }

    if (head === 'tenant') return { kind: 'tenant' };
    if (head === 'admin') return { kind: 'admin' };
    return null;
  }, [pathname, orgs]);

  React.useEffect(() => {
    setContext(ctx);
  }, [ctx, setContext]);

  return ctx;
}
