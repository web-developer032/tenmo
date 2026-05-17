import { ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
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
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/tenant">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to your home
        </Link>
      </Button>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">My applications</h1>
        <p className="text-sm text-muted-foreground">
          Track every room you've applied for. Tenancies are free for tenants — Tenantly will never
          charge you a fee.
        </p>
      </header>

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
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">
                          <Link href={`/listings/${row.room_id}`} className="hover:underline">
                            {row.room_name}
                          </Link>{' '}
                          <span className="text-sm font-normal text-muted-foreground">
                            · {row.property_name}
                          </span>
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {row.org_name}
                          {row.property_city ? ` · ${row.property_city}` : ''}
                          {rent ? ` · ${rent}` : ''}
                        </p>
                      </div>
                      <ApplicationStatusBadge status={row.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p className="text-xs text-muted-foreground">
                      Applied {new Date(row.applied_at).toLocaleDateString('en-GB')}
                      {row.decided_at
                        ? ` · Decided ${new Date(row.decided_at).toLocaleDateString('en-GB')}`
                        : ''}
                    </p>
                    {row.message ? (
                      <p className="whitespace-pre-line rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                        {row.message}
                      </p>
                    ) : null}
                    {row.status === 'rejected' && row.decline_reason ? (
                      <p className="text-xs text-muted-foreground">
                        {isRoomFilledRejection(row)
                          ? 'The landlord chose another applicant — keep browsing similar rooms.'
                          : `Landlord said: ${row.decline_reason}`}
                      </p>
                    ) : null}
                    {row.status === 'accepted' && row.resulting_tenancy_id ? (
                      <p className="text-xs text-success">
                        Accepted! Check your email for the tenancy invite, or{' '}
                        <Link href="/" className="underline">
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
