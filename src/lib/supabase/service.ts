import { createServerClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env.public';
import { getServerEnv } from '@/lib/env.server';

/**
 * Service-role Supabase client. RLS is bypassed.
 *
 * Use ONLY in:
 *   - Webhook handlers (after signature verification).
 *   - Inngest job functions.
 *   - Admin tooling.
 *
 * Never reachable from a user-facing request path.
 */
export function createServiceClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  return createServerClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    cookies: {
      getAll: () => [],
      setAll: () => {
        /* noop — service role doesn't manage user cookies */
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
