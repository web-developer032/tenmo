import { cookies } from 'next/headers';

/**
 * Server-side helpers for the cross-context "last workspace" cookie.
 *
 * Workspace-scoped routes (`/landlord/{slug}/...`, `/tenant/...`,
 * `/admin/...`) are detected by `proxy.ts` and persisted into a small
 * JSON cookie. Cross-context routes (`/messages`, `/notifications`)
 * call {@link readRememberedWorkspace} from their layout to pick the
 * matching sidebar — without it the `/messages` shell would render
 * with no nav at all.
 *
 * The cookie is `httpOnly: false` so the role-switcher client can also
 * persist + read it from the browser if it ever needs to.
 *
 * Values are serialised as JSON:
 *   { "kind": "landlord", "slug": "sara-lets" }
 *   { "kind": "tenant" }
 *   { "kind": "admin" }
 *
 * Writing happens in `proxy.ts` (Edge runtime) because Next.js 15+
 * does not let Server Components mutate cookies.
 */

export const WORKSPACE_COOKIE_NAME = 'tly-workspace';

export type RememberedWorkspace =
  | { kind: 'landlord'; slug: string }
  | { kind: 'tenant' }
  | { kind: 'admin' };

export async function readRememberedWorkspace(): Promise<RememberedWorkspace | null> {
  const store = await cookies();
  const raw = store.get(WORKSPACE_COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RememberedWorkspace;
    if (parsed.kind === 'landlord' && typeof parsed.slug === 'string') return parsed;
    if (parsed.kind === 'tenant') return parsed;
    if (parsed.kind === 'admin') return parsed;
    return null;
  } catch {
    return null;
  }
}
