import { Check, KeyRound, ShieldCheck, ShieldOff, X } from 'lucide-react';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loadCurrentProfile } from '@/features/account/loaders';
import { AdminProfileForm } from '@/features/admin/components/admin-profile-form';
import { AdminSignOutButton } from '@/features/admin/components/admin-sign-out-button';
import {
  PERMISSIONS,
  ROLE_LABEL,
  ROLE_PERMISSIONS,
  ROLE_SUB,
} from '@/features/admin/data/role-permissions';
import { getAdminSelf } from '@/features/admin/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * /admin/profile — the calling admin's own profile + security view.
 *
 * Four sections: personal details (PATCHes `/api/profile`), security
 * (password change link + 2FA status + sign out), permissions list
 * (computed from the caller's `admin_users.role`), and active
 * session metadata read from Supabase auth.
 */
export default async function AdminProfilePage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !session) redirect('/login?redirect=/admin/profile');

  const [self, profile] = await Promise.all([
    getAdminSelf(supabase, user.id),
    loadCurrentProfile(),
  ]);

  if (!profile) redirect('/login?redirect=/admin/profile');

  const matrix = ROLE_PERMISSIONS[self.role];

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'My profile' }]}
        title="My profile"
        description={`Signed in as ${ROLE_LABEL[self.role]} · ${ROLE_SUB[self.role]}.`}
      />

      <ResponsiveGrid preset="cards-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminProfileForm
              initial={{
                full_name: profile.full_name,
                preferred_name: profile.preferred_name,
                contact_email: profile.contact_email,
                contact_phone: profile.contact_phone,
              }}
            />
            <p className="mt-3 text-[11.5px] text-ink-light">
              Your sign-in email ({profile.email}) is managed via Supabase auth. Changing it
              triggers a separate verification flow.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <div className="flex items-center justify-between rounded-button bg-bg-page px-4 py-3">
              <div>
                <div className="font-semibold text-ink">Password</div>
                <div className="text-[11.5px] text-ink-light">
                  Reset via the email-based recovery flow.
                </div>
              </div>
              <Button asChild size="sm" variant="outline">
                <a href="/account/security">
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                  Change
                </a>
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-button bg-bg-page px-4 py-3">
              <div>
                <div className="font-semibold text-ink">Two-factor authentication</div>
                <div className="text-[11.5px] text-ink-light">
                  {self.two_factor_enabled
                    ? 'Authenticator app enrolled.'
                    : 'Not enrolled — required for super admins.'}
                </div>
              </div>
              {self.two_factor_enabled ? (
                <Badge variant="success">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="warning">
                  <ShieldOff className="mr-1 h-3 w-3" />
                  Off
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between rounded-button bg-bg-page px-4 py-3">
              <div>
                <div className="font-semibold text-ink">Sign out</div>
                <div className="text-[11.5px] text-ink-light">End this session everywhere.</div>
              </div>
              <AdminSignOutButton />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your permissions</CardTitle>
            <Badge variant="info">{ROLE_LABEL[self.role]}</Badge>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-[12px] text-ink-light">{ROLE_SUB[self.role]}</p>
            <div className="space-y-1.5">
              {PERMISSIONS.map((perm) => (
                <div
                  key={perm.id}
                  className="flex items-center justify-between rounded-button bg-bg-page px-3.5 py-2.5"
                >
                  <div>
                    <div className="text-[13px] font-semibold text-ink">{perm.label}</div>
                    <div className="text-[11px] text-ink-light">{perm.area}</div>
                  </div>
                  {matrix[perm.id] ? (
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-forest-700">
                      <Check className="h-3.5 w-3.5" />
                      Granted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-light">
                      <X className="h-3.5 w-3.5" />
                      Denied
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active session</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-[13px]">
              <Row
                label="User ID"
                value={<code className="font-mono text-[11.5px]">{user.id}</code>}
              />
              <Row
                label="Last sign-in"
                value={formatDate(user.last_sign_in_at ?? session.user.last_sign_in_at)}
              />
              <Row
                label="Session expires"
                value={
                  session.expires_at
                    ? formatDate(new Date(session.expires_at * 1000).toISOString())
                    : '—'
                }
              />
              <Row
                label="Email confirmed"
                value={
                  user.email_confirmed_at ? (
                    <Badge variant="success">Verified</Badge>
                  ) : (
                    <Badge variant="urgent">Unverified</Badge>
                  )
                }
              />
              <Row
                label="Provider"
                value={(user.app_metadata as { provider?: string } | null)?.provider ?? 'email'}
              />
              <Row
                label="Admin since"
                value={self.last_active_at ? formatDate(self.last_active_at) : '—'}
              />
            </dl>
          </CardContent>
        </Card>
      </ResponsiveGrid>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border-soft pb-2 last:border-b-0">
      <dt className="font-semibold text-ink-light">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
