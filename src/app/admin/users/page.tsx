import { Check, Lock, ShieldCheck, X } from 'lucide-react';
import { redirect } from 'next/navigation';
import { AvRow } from '@/components/ds/av-row';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminMemberActions } from '@/features/admin/components/admin-member-actions';
import { AllProfilesSearchPopover } from '@/features/admin/components/all-profiles-search-popover';
import { InviteAdminDialog } from '@/features/admin/components/invite-admin-dialog';
import {
  PERMISSIONS,
  type PermissionRow,
  ROLE_LABEL,
  ROLE_PERMISSIONS,
  ROLE_SUB,
} from '@/features/admin/data/role-permissions';
import { loadAdminTeam } from '@/features/admin/loaders';
import type { AdminRole } from '@/features/admin/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * /admin/users — User Management for the Tenantly admin team.
 *
 * Three cards: admin team members, pending invites, and the static
 * role-permissions matrix. The legacy "list every profile on the
 * platform" function moved out — landlords + tenants live under
 * their own dedicated pages; a global search popover in the topbar
 * keeps the deep-link capability.
 */
export default async function AdminUserManagementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin/users');

  const team = await loadAdminTeam();

  // Layout already loaded admin_users; we re-read just the caller's row
  // here to know whether they can edit.
  const callerRow = team.members.find((m) => m.user_id === user.id);
  const canEdit = callerRow?.role === 'super';

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'User management' }]}
        title="User management"
        description="Manage Tenantly admin staff and their access levels."
        actions={
          <>
            <AllProfilesSearchPopover />
            <InviteAdminDialog disabled={!canEdit} />
          </>
        }
      />

      <ResponsiveGrid preset="cards-2">
        {/* Admin team */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Admin team</CardTitle>
            <span className="text-[12px] text-ink-light">
              {team.members.length} member{team.members.length === 1 ? '' : 's'}
            </span>
          </CardHeader>
          <CardContent>
            {team.members.length === 0 ? (
              <p className="text-[13px] text-ink-light">No admin team members yet.</p>
            ) : (
              <div className="flex flex-col">
                {team.members.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex flex-col gap-2 border-b border-border-soft py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <AvRow
                      size="sm"
                      name={m.display_name ?? m.full_name ?? m.email ?? 'Admin'}
                      sub={
                        <span>
                          {m.email ?? '—'} · {ROLE_LABEL[m.role]}
                          {m.last_active_at ? ` · active ${relativeTime(m.last_active_at)}` : ''}
                        </span>
                      }
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {m.two_factor_enabled ? (
                        <Badge variant="success">
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          2FA on
                        </Badge>
                      ) : (
                        <Badge variant="warning">2FA off</Badge>
                      )}
                      {m.status === 'disabled' ? <Badge variant="urgent">Disabled</Badge> : null}
                      <AdminMemberActions
                        userId={m.user_id}
                        currentRole={m.role}
                        canEdit={!!canEdit}
                        isSelf={m.user_id === user.id}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending invites */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pending invites</CardTitle>
            <span className="text-[12px] text-ink-light">{team.invites.length} pending</span>
          </CardHeader>
          <CardContent>
            {team.invites.length === 0 ? (
              <p className="text-[13px] text-ink-light">No pending invites.</p>
            ) : (
              <div className="flex flex-col">
                {team.invites.map((inv) => {
                  const expiresAt = new Date(inv.expires_at);
                  const expired = expiresAt.getTime() < Date.now();
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between gap-3 border-b border-border-soft py-3 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-ink">{inv.email}</div>
                        <div className="text-[12px] text-ink-light">
                          {ROLE_LABEL[inv.role]} · invited {relativeTime(inv.created_at)} by{' '}
                          {inv.invited_by_name ?? 'unknown'}
                        </div>
                      </div>
                      <div>
                        {expired ? (
                          <Badge variant="urgent">Expired</Badge>
                        ) : (
                          <Badge variant="info">
                            Expires {expiresAt.toLocaleDateString('en-GB')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </ResponsiveGrid>

      {/* Role / permission matrix */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Role permissions</CardTitle>
          <span className="text-[12px] text-ink-light">
            <Lock className="mr-1 inline h-3 w-3" />
            Defined in code · `frontend/src/features/admin/data/role-permissions.ts`
          </span>
        </CardHeader>
        <CardContent>
          <RolePermissionMatrix />
        </CardContent>
      </Card>
    </div>
  );
}

function RolePermissionMatrix() {
  const roles: AdminRole[] = ['super', 'support', 'finance', 'readonly'];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="bg-bg-page text-left text-[11px] font-bold uppercase tracking-wider text-ink-light">
          <tr>
            <th className="px-3 py-2.5 font-bold">Permission</th>
            {roles.map((r) => (
              <th key={r} className="px-3 py-2.5 text-center font-bold">
                {ROLE_LABEL[r]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS.map((perm: PermissionRow) => (
            <tr key={perm.id} className="border-b border-border-soft last:border-b-0">
              <td className="px-3 py-2.5">
                <div className="font-semibold text-ink">{perm.label}</div>
                <div className="text-[11px] text-ink-light">{perm.area}</div>
              </td>
              {roles.map((r) =>
                ROLE_PERMISSIONS[r][perm.id] ? (
                  <td key={r} className="px-3 py-2.5 text-center text-forest-600">
                    <Check className="mx-auto h-4 w-4" />
                  </td>
                ) : (
                  <td key={r} className="px-3 py-2.5 text-center text-ink-light">
                    <X className="mx-auto h-4 w-4" />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="px-3 pt-3 text-[11px] text-ink-light">Summary</td>
            {(['super', 'support', 'finance', 'readonly'] as AdminRole[]).map((r) => (
              <td key={r} className="px-3 pt-3 text-center text-[11px] text-ink-light">
                {ROLE_SUB[r]}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB');
}
