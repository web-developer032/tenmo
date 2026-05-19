import { ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/ds/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isRoomFilledRejection } from '@/core/schemas/application';
import { formatMoney } from '@/core/utils/money';
import { ApplicationStatusBadge } from '@/features/applications/components/application-status-badge';
import { WithdrawApplicationButton } from '@/features/applications/components/withdraw-button';
import { listMyApplicationsWithClient } from '@/features/applications/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function TenantApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/tenant/applications');

  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;
  const result = await listMyApplicationsWithClient(supabase, user.id, page);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Tenant', href: '/tenant' }, { label: 'My applications' }]}
        title="My applications"
        description="Track every room you've applied for. Tenancies are free for tenants — Tenantly will never charge you a fee."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/tenant">
              <ArrowLeft className="h-4 w-4" /> Back to your home
            </Link>
          </Button>
        }
      />

      {result.rows.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="You haven't applied to any rooms yet"
          description="Browse the public listings and apply to the ones that look right for you. Every landlord on Tenantly is compliant with the Renters' Rights Bill."
          cta={{ label: 'Browse listings', href: '/listings' }}
        />
      ) : (
        <ul className="space-y-3">
          {result.rows.map((row) => {
            const rent = row.default_rent_pence
              ? `${formatMoney(row.default_rent_pence)}${row.default_rent_frequency === 'weekly' ? ' / wk' : ' / mo'}`
              : '';
            return (
              <li key={row.id}>
                <Card>
                  <CardHeader className="flex-col items-stretch gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>
                        <Link
                          href={`/listings/${row.room_id}`}
                          className="text-ink hover:text-forest-600 hover:underline"
                        >
                          {row.room_name}
                        </Link>{' '}
                        <span className="text-[12.5px] font-medium text-ink-light">
                          · {row.property_name}
                        </span>
                      </CardTitle>
                      <p className="text-[12px] text-ink-light">
                        {row.org_name}
                        {row.property_city ? ` · ${row.property_city}` : ''}
                        {rent ? ` · ${rent}` : ''}
                      </p>
                    </div>
                    <ApplicationStatusBadge status={row.status} />
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p className="text-[12px] text-ink-light">
                      Applied {new Date(row.applied_at).toLocaleDateString('en-GB')}
                      {row.decided_at
                        ? ` · Decided ${new Date(row.decided_at).toLocaleDateString('en-GB')}`
                        : ''}
                    </p>
                    {row.message ? (
                      <p className="whitespace-pre-line rounded-button border border-border-soft bg-foam/30 p-3 text-[12px] text-ink-mid">
                        {row.message}
                      </p>
                    ) : null}
                    {row.status === 'rejected' && row.decline_reason ? (
                      <p className="text-[12px] text-ink-light">
                        {isRoomFilledRejection(row)
                          ? 'The landlord chose another applicant — keep browsing similar rooms.'
                          : `Landlord said: ${row.decline_reason}`}
                      </p>
                    ) : null}
                    {row.status === 'accepted' && row.resulting_tenancy_id ? (
                      <p className="text-[12px] font-medium text-forest-700">
                        Accepted! Check your email for the tenancy invite, or{' '}
                        <Link href="/" className="font-semibold underline-offset-4 hover:underline">
                          open your invites
                        </Link>
                        .
                      </p>
                    ) : null}
                    {row.status === 'pending' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <WithdrawApplicationButton applicationId={row.id} />
                      </div>
                    ) : null}
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
