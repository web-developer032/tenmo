import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell/app-shell';
import { createClient } from '@/lib/supabase/server';

/**
 * Layout for /tenant/* — any authenticated user may visit this (it's a personal
 * dashboard scoped to their tenancies). RLS ensures only their own tenancies
 * are visible. If they have no tenancies, the inner page renders an empty state.
 */
export default async function TenantLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/tenant');

  return <AppShell>{children}</AppShell>;
}
