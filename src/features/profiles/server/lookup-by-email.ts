import 'server-only';
import { z } from 'zod';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Server-side helper for "does this email already have a Tenantly account?".
 *
 * Calls `public.profile_exists_for_email`, a SECURITY DEFINER SQL function
 * that consults both `profiles.contact_email` and `auth.users.email` — so
 * users who never edited their profile are still found.
 *
 * To prevent enumeration the calling endpoint
 * (`app/api/profiles/lookup-by-email`) is hard rate-limited per IP via
 * Upstash. We never return any profile data — only `{ exists, email }` —
 * which keeps the oracle limited to a single boolean per request.
 */
const log = () => getLogger().child({ module: 'profiles.lookup-by-email' });

export const LookupByEmailInput = z.object({
  email: z.string().email(),
});
export type LookupByEmailInput = z.infer<typeof LookupByEmailInput>;

export interface LookupByEmailResult {
  email: string;
  exists: boolean;
}

export async function lookupProfileByEmail(
  input: LookupByEmailInput,
): Promise<LookupByEmailResult> {
  const normalisedEmail = input.email.trim().toLowerCase();
  const sb = createServiceClient();

  const { data, error } = await sb.rpc('profile_exists_for_email', {
    p_email: normalisedEmail,
  });
  if (error) {
    log().warn({ err: error }, 'profile_exists_for_email RPC failed');
    return { email: normalisedEmail, exists: false };
  }
  return { email: normalisedEmail, exists: Boolean(data) };
}
