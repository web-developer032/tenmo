import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell/app-shell';
import { createClient } from '@/lib/supabase/server';

/**
 * Layout for /admin/* — platform staff only. Membership is managed via the
 * `admin_users` table (row exists ↔ user is admin). RLS prevents anyone else
 * from seeing the row, so we treat "no row" as 404 rather than 403 to avoid
 * advertising the page exists.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin');

  const { data: admin } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!admin) notFound();

  return <AppShell>{children}</AppShell>;
}
