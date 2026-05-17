import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { KV } from '@/components/common/kv';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminNav } from '@/features/admin/components/admin-nav';
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
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {profile.full_name ?? profile.preferred_name ?? '(no name)'}
          </h1>
          {is_admin ? (
            <span
              className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-primary text-xs"
              title="Platform admin"
            >
              <ShieldCheck className="h-3 w-3" /> Platform admin
            </span>
          ) : null}
          {profile.flag_abuse_review ? (
            <span className="inline-flex items-center rounded bg-rose-500/10 px-2 py-0.5 text-rose-700 text-xs dark:text-rose-300">
              Flagged for abuse review
            </span>
          ) : null}
        </div>
        <p className="font-mono text-muted-foreground text-xs">{profile.id}</p>
      </header>

      <AdminNav />

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
