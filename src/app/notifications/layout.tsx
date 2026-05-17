import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell/app-shell';
import { createClient } from '@/lib/supabase/server';

/**
 * Layout for `/notifications` and `/account/*`.
 *
 * Personal pages — accessible to any authenticated user. Wraps everything
 * in the standard app shell so the bell + role switcher stay visible.
 */
export default async function PersonalLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/notifications');
  return <AppShell>{children}</AppShell>;
}
