import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { KV } from '@/components/common/kv';
import { PageHeader } from '@/components/ds/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loadAdminUserDetail } from '@/features/admin/loaders';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * /admin/users/[id] — read-only profile view: identity, admin
 * status, every org they belong to, every tenancy they hold.
 *
 * No actions yet — for MVP we rely on RLS giving admins full read
 * access via `is_admin()`. Write actions (force-reset password,
 * toggle abuse flag, etc.) land in the next phase.
 */
export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await loadAdminUserDetail(id);
  const { profile, memberships, tenancies, is_admin, admin_notes } = detail;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Users', href: '/admin/users' },
          { label: profile.full_name ?? profile.preferred_name ?? '(no name)' },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {profile.full_name ?? profile.preferred_name ?? '(no name)'}
            {is_admin ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-foam px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-forest-700"
                title="Platform admin"
              >
                <ShieldCheck className="h-3 w-3" /> Platform admin
              </span>
            ) : null}
            {profile.flag_abuse_review ? (
              <span className="inline-flex items-center rounded-full bg-alert-bg px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-alert">
                Flagged
              </span>
            ) : null}
          </span>
        }
        description={<span className="font-mono text-[11.5px] text-ink-light">{profile.id}</span>}
        actions={
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink-light hover:text-forest-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to users
          </Link>
        }
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <KV label="Email" value={profile.contact_email} />
            <KV label="Phone" value={profile.contact_phone} />
            <KV label="Locale" value={profile.locale} />
            <KV label="Timezone" value={profile.timezone} />
            <KV label="Joined" value={new Date(profile.created_at).toLocaleString('en-GB')} />
            <KV label="Last update" value={new Date(profile.updated_at).toLocaleString('en-GB')} />
          </CardContent>
        </Card>

        {is_admin ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Admin notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                {admin_notes ?? <span className="text-muted-foreground">No notes.</span>}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Org memberships ({memberships.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {memberships.length === 0 ? (
            <p className="text-muted-foreground text-sm">Not a member of any org.</p>
          ) : (
            <ul className="divide-y text-sm">
              {memberships.map((m) => (
                <li
                  key={`${m.org_id}-${m.role}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <Link href={`/admin/orgs/${m.org_id}`} className="font-medium hover:underline">
                    {m.org_name}
                  </Link>
                  <div className="flex items-center gap-3 text-muted-foreground text-xs">
                    <span className="rounded bg-muted px-1.5 py-0.5 capitalize">{m.role}</span>
                    {m.revoked_at ? (
                      <span className="text-destructive">
                        revoked {new Date(m.revoked_at).toLocaleDateString('en-GB')}
                      </span>
                    ) : m.accepted_at ? (
                      <span>joined {new Date(m.accepted_at).toLocaleDateString('en-GB')}</span>
                    ) : (
                      <span>invited (pending)</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenancies ({tenancies.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {tenancies.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tenancies on record.</p>
          ) : (
            <ul className="divide-y text-sm">
              {tenancies.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="space-y-0.5">
                    <p className="font-medium">{t.property_name}</p>
                    <p className="text-muted-foreground text-xs">
                      <Link href={`/admin/orgs/${t.org_id}`} className="hover:underline">
                        {t.org_name}
                      </Link>{' '}
                      · {t.start_date ?? '—'} → {t.end_date ?? 'open'}
                    </p>
                  </div>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs capitalize">
                    {t.status.replace(/_/g, ' ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
