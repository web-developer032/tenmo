import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env.public';

/**
 * Browser Supabase client — used inside Client Components.
 * Reads the auth cookie set by the SSR middleware.
 */
export function createClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
