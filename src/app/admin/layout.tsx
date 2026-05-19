import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminSidebar } from '@/components/app-shell/admin-sidebar';
import { AppShell } from '@/components/app-shell/app-shell';
import { getAdminSidebarCountsWithClient } from '@/features/admin/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Layout for /admin/* — platform staff only.
 *
 * Access control:
 *   - Unauthenticated  → redirect to /login
 *   - Authenticated, no admin_users row  → 404 (admins must not be
 *     discoverable by probing this URL).
 *   - Disabled admin   → also 404 — login alone shouldn't reveal the
 *     existence of a deactivated admin account.
 *
 * Once admitted, we hydrate the sidebar badges (landlords, tenants,
 * open tickets, compliance criticals, billing failures) so navigation
 * mirrors the live state of the platform.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin');

  const { data: admin } = await supabase
    .from('admin_users')
    .select('user_id, status, display_name, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!admin || admin.status === 'disabled') notFound();

  const profileResp = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const fullName = admin.display_name ?? profileResp.data?.full_name ?? user.email ?? 'Admin';
  const initials =
    fullName
      .split(/\s+/)
      .map((p: string) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'A';

  // Sidebar counters drive the badge pills. Wrapped in try/catch so a
  // half-applied migration doesn't lock the whole admin console out.
  let counts: Awaited<ReturnType<typeof getAdminSidebarCountsWithClient>> | undefined;
  try {
    counts = await getAdminSidebarCountsWithClient(supabase);
  } catch {
    counts = undefined;
  }

  return (
    <AppShell
      sidebar={
        <AdminSidebar
          userInitials={initials}
          userName={fullName}
          userSub={user.email ?? undefined}
          counts={counts}
        />
      }
      pageTitle="Admin"
      pageSubtitle="Platform overview"
    >
      <div className="min-w-0 p-4 lg:p-7">{children}</div>
    </AppShell>
  );
}
