import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Next.js 16 "proxy" file — replaces the deprecated `middleware.ts` convention.
 *
 * Runs before every matched request to refresh the Supabase auth cookies via
 * `@supabase/ssr`. Keep this fast — it executes in the Edge runtime by default.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
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
