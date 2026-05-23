import type { NextRequest } from 'next/server';
import { WORKSPACE_COOKIE_NAME } from '@/features/app-shell/server/active-workspace';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Next.js 16 "proxy" file — replaces the deprecated `middleware.ts` convention.
 *
 * Runs before every matched request to:
 *   1. refresh the Supabase auth cookies via `@supabase/ssr`.
 *   2. remember the caller's active workspace (`/landlord/{slug}`, `/tenant`,
 *      `/admin`) in a small JSON cookie so cross-context routes such as
 *      `/messages` and `/notifications` know which sidebar to render.
 *
 * Keep this fast — it executes in the Edge runtime by default.
 */
export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  rememberWorkspaceFromPath(request, response);
  return response;
}

function rememberWorkspaceFromPath(
  request: NextRequest,
  response: ReturnType<typeof updateSession> extends Promise<infer R> ? R : never,
): void {
  const path = request.nextUrl.pathname;
  const segments = path.split('/').filter(Boolean);
  const head = segments[0];

  let value: string | null = null;
  if (head === 'landlord' && segments[1]) {
    value = JSON.stringify({ kind: 'landlord', slug: segments[1] });
  } else if (head === 'tenant') {
    value = JSON.stringify({ kind: 'tenant' });
  } else if (head === 'admin') {
    value = JSON.stringify({ kind: 'admin' });
  }

  if (value === null) return;
  if (request.cookies.get(WORKSPACE_COOKIE_NAME)?.value === value) return;

  response.cookies.set({
    name: WORKSPACE_COOKIE_NAME,
    value,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (assets)
     * - favicon.ico, icon, manifest, robots, sitemap
     * - public assets (svg, png, jpg, jpeg, gif, webp, ico)
     */
    '/((?!_next/static|_next/image|favicon.ico|icon|manifest|robots|sitemap|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
