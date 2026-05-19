import { Home, Plus } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/ds/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/core/utils/money';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { loadOrgTenancies } from '@/features/tenancies/loaders';
import { tenancyStatusDisplay } from '@/features/tenancies/status-display';

type Params = { slug: string };

export default async function LandlordTenanciesPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const tenancies = await loadOrgTenancies(org.id);

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Tenancies' },
        ]}
        title="Tenancies"
        description="Invite tenants, manage active lets and end tenancies in line with the Renters' Rights Bill."
        actions={
          <Button asChild>
            <Link href={`/landlord/${slug}/properties`}>
              <Plus className="h-4 w-4" /> Invite a tenant
            </Link>
          </Button>
        }
      />

      {tenancies.length === 0 ? (
        <EmptyState
          icon={<Home className="h-6 w-6" />}
          title="No tenancies yet"
          description="Invite a tenant from any property to get started. Your tenants are free, forever."
          cta={{ label: 'Choose a property', href: `/landlord/${slug}/properties` }}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {tenancies.map((t) => {
            const status = tenancyStatusDisplay(t.status);
            return (
              <li key={t.id}>
                <Link href={`/landlord/${slug}/tenancies/${t.id}`}>
                  <Card className="transition-colors hover:border-forest-200 hover:bg-foam/40">
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-center gap-2">
                        {t.property_name ?? 'Property'}
                        {t.room_name ? (
                          <span className="text-ink-light">— {t.room_name}</span>
                        ) : null}
                      </CardTitle>
                      <Badge className={status.tone}>{status.label}</Badge>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 text-[13px] md:grid-cols-4">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-ink-light">
                          Tenant
                        </div>
                        <div className="truncate font-semibold text-ink">
                          {t.tenant_email ?? '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-ink-light">
                          Start
                        </div>
                        <div className="font-semibold text-ink">{t.start_date}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-ink-light">
                          Rent
                        </div>
                        <div className="font-semibold text-ink">
                          {formatMoney(t.rent_pence)}{' '}
                          {t.rent_frequency === 'weekly' ? '/wk' : '/mo'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-ink-light">
                          Deposit
                        </div>
                        <div className="font-semibold text-ink">{formatMoney(t.deposit_pence)}</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
