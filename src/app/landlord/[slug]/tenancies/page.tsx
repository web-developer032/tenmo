import { Home, Plus } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
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
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Tenancies</h1>
          <p className="text-sm text-muted-foreground">
            Invite tenants, manage active lets and end tenancies in line with the Renters&apos;
            Rights Bill.
          </p>
        </div>
        <Button asChild>
          <Link href={`/landlord/${slug}/properties`}>
            <Plus className="mr-2 h-4 w-4" />
            Invite a tenant
          </Link>
        </Button>
      </header>

      {tenancies.length === 0 ? (
        <EmptyState
          icon={<Home className="h-6 w-6" />}
          title="No tenancies yet"
          description="Invite a tenant from any property to get started. Your tenants are free, forever."
          cta={{ label: 'Choose a property', href: `/landlord/${slug}/properties` }}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {tenancies.map((t) => {
            const status = tenancyStatusDisplay(t.status);
            return (
              <li key={t.id}>
                <Link href={`/landlord/${slug}/tenancies/${t.id}`}>
                  <Card className="transition-colors hover:bg-muted/40">
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        {t.property_name ?? 'Property'}
                        {t.room_name ? (
                          <span className="text-muted-foreground">— {t.room_name}</span>
                        ) : null}
                      </CardTitle>
                      <Badge className={status.tone}>{status.label}</Badge>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                      <div>
                        <div className="text-muted-foreground">Tenant</div>
                        <div className="truncate font-medium">{t.tenant_email ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Start</div>
                        <div className="font-medium">{t.start_date}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Rent</div>
                        <div className="font-medium">
                          {formatMoney(t.rent_pence)}{' '}
                          {t.rent_frequency === 'weekly' ? '/wk' : '/mo'}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Deposit</div>
                        <div className="font-medium">{formatMoney(t.deposit_pence)}</div>
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
