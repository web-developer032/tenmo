import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell/app-shell';
import { createClient } from '@/lib/supabase/server';

/**
 * Layout for `/messages` and `/messages/[id]` — accessible to any
 * authenticated user (RLS handles which conversations they can see).
 * Wraps everything in the standard app shell so the inbox icon, bell,
 * and role switcher stay visible.
 */
export default async function MessagesLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/messages');
  return <AppShell>{children}</AppShell>;
}
