import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell/app-shell';
import { createClient } from '@/lib/supabase/server';

/**
 * Layout for `/account/*` — personal account settings (profile, prefs).
 *
 * Any authenticated user may visit. Unauthenticated requests are sent to
 * /login with a redirect back to the original path.
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/account');
  return <AppShell>{children}</AppShell>;
}
