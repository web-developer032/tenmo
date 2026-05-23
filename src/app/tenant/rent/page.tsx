import { ArrowLeft, ArrowRight, CreditCard, Wallet } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/ds/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/core/utils/money';
import { CHOOSABLE_TENANCY_STATUSES, chooseTenancyTarget } from '@/core/utils/tenancy-chooser';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * `/tenant/rent` — index page.
 *
 * The actual rent ledger lives at `/tenant/rent/[tenancyId]`. This
 * index decides where to send the caller:
 *
 *   - 0 active tenancies → empty state (CTA: browse listings).
 *   - 1 active tenancy   → redirect straight to the ledger.
 *   - 2+ tenancies       → render a picker of cards.
 *
 * RLS scopes results to the caller. The chooser logic itself is
 * portable and unit-tested in `core/utils/__tests__`.
 */
export default async function TenantRentIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/tenant/rent');

  const { data: rows } = await supabase
    .from('tenancies')
    .select(
      `id, status, start_date, rent_pence, rent_frequency, rent_due_day,
       properties:property_id ( name ),
       rooms:room_id ( name )`,
    )
    .eq('tenant_user_id', user.id)
    .in('status', CHOOSABLE_TENANCY_STATUSES as unknown as string[]);

  const tenancies = rows ?? [];
  const decision = chooseTenancyTarget(
    tenancies.map((t) => ({ id: t.id, status: t.status, start_date: t.start_date })),
  );

  if (decision.kind === 'one') {
    redirect(`/tenant/rent/${decision.targetId}`);
  }

  const detailById = new Map(tenancies.map((t) => [t.id, t]));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Tenant', href: '/tenant' }, { label: 'Payments' }]}
        title={
          <span className="inline-flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-forest-600" />
            Your rent &amp; payments
          </span>
        }
        description="Open the ledger for any tenancy to see charges, payments and your Direct Debit status."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/tenant">
              <ArrowLeft className="h-4 w-4" /> Back to your home
            </Link>
          </Button>
        }
      />

      {decision.kind === 'empty' ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="No tenancies yet"
          description="Once your landlord invites you and you accept, your rent ledger will appear here."
          cta={{ label: 'Browse listings', href: '/listings' }}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {decision.tenancies.map((row) => {
            const detail = detailById.get(row.id);
            if (!detail) return null;
            const property = pickFirst<{ name: string }>(detail.properties);
            const room = pickFirst<{ name: string }>(detail.rooms);
            const frequencySuffix = detail.rent_frequency === 'weekly' ? 'pw' : 'pcm';
            return (
              <li key={row.id}>
                <Card>
                  <CardHeader className="flex-col items-stretch gap-1 sm:flex-row sm:items-center">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="truncate">
                        {property?.name ?? 'Your home'}
                        {room?.name ? (
                          <span className="text-ink-light"> — {room.name}</span>
                        ) : null}
                      </CardTitle>
                      <CardDescription>
                        {formatMoney(detail.rent_pence)} {frequencySuffix} · due day{' '}
                        {detail.rent_due_day} · started {detail.start_date}
                      </CardDescription>
                    </div>
                    <Button asChild size="sm">
                      <Link href={`/tenant/rent/${row.id}`}>
                        Open ledger <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="text-[12.5px] text-ink-light">
                    Status: <span className="font-semibold text-ink">{detail.status}</span>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}
