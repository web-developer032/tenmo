import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { KV } from '@/components/common/kv';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminNav } from '@/features/admin/components/admin-nav';
import { StatusBadge, TierBadge } from '@/features/admin/components/subscription-badges';
import { SubscriptionOverrideForm } from '@/features/admin/components/subscription-override-form';
import { loadAdminOrgDetail } from '@/features/admin/loaders';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ orgId: string }>;
}

/**
 * /admin/orgs/[orgId] — read-only org detail with the subscription
 * override form and live usage counts.
 */
export default async function AdminOrgDetailPage({ params }: PageProps) {
  const { orgId } = await params;
  const detail = await loadAdminOrgDetail(orgId);
  const { org, subscription, members, usage } = detail;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <Link
        href="/admin/orgs"
        className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to organisations
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{org.name}</h1>
          <TierBadge
            tier={subscription?.override_tier ?? subscription?.tier ?? null}
            override={!!subscription?.override_tier}
          />
          <StatusBadge status={subscription?.status ?? null} />
        </div>
        <p className="font-mono text-muted-foreground text-xs">
          {org.slug} · {org.id}
        </p>
      </header>

      <AdminNav />

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Org details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <KV label="Contact email" value={org.contact_email} />
            <KV label="Contact phone" value={org.contact_phone} />
            <KV label="Company number" value={org.company_number} />
            <KV label="VAT number" value={org.vat_number} />
            <KV label="Created" value={new Date(org.created_at).toLocaleString('en-GB')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            <UsageStat label="Properties" value={usage.properties} />
            <UsageStat label="Rooms" value={usage.rooms} />
            <UsageStat label="Active tenancies" value={usage.tenancies} />
            <UsageStat label="Org members" value={usage.org_members} />
          </CardContent>
        </Card>
      </section>

      <SubscriptionOverrideForm
        orgId={org.id}
        currentOverrideTier={subscription?.override_tier ?? null}
        currentOverrideReason={subscription?.override_reason ?? null}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-sm">No members.</p>
          ) : (
            <ul className="divide-y text-sm">
              {members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <Link href={`/admin/users/${m.user_id}`} className="font-medium hover:underline">
                    {m.full_name ?? m.contact_email ?? '(no name)'}
                  </Link>
                  <div className="flex items-center gap-3 text-muted-foreground text-xs">
                    <span className="rounded bg-muted px-1.5 py-0.5 capitalize">{m.role}</span>
                    {m.revoked_at ? <span className="text-destructive">revoked</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UsageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-muted/20 p-3">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
      <p className="font-semibold text-xl">{value.toLocaleString('en-GB')}</p>
    </div>
  );
}
