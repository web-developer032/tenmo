import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-only loader for "the caller's own profile + auth identity".
 *
 * Used by `/account` and `/account/settings/*` to render personal info
 * without each page doing its own Supabase fetch. RLS ensures only the
 * caller's own row is visible (`profiles_select_self`), so this is safe
 * without an extra explicit user-id filter beyond the one we apply.
 *
 * Returns `null` if the request is unauthenticated; pages should redirect
 * to /login in that case.
 */

export type CurrentProfile = {
  id: string;
  email: string;
  full_name: string | null;
  preferred_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  locale: string;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  marketing_opt_in: boolean;
  created_at: string;
};

export async function loadCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, preferred_name, contact_email, contact_phone, locale, timezone, theme, marketing_opt_in, created_at',
    )
    .eq('id', user.id)
    .maybeSingle();
  if (error || !data) return null;

  return {
    id: data.id,
    email: user.email ?? '',
    full_name: data.full_name,
    preferred_name: data.preferred_name,
    contact_email: data.contact_email,
    contact_phone: data.contact_phone,
    locale: data.locale,
    timezone: data.timezone,
    theme: data.theme as 'light' | 'dark' | 'system',
    marketing_opt_in: data.marketing_opt_in,
    created_at: data.created_at,
  };
}
