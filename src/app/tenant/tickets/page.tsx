import { Wrench } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TICKET_OPEN_STATUSES, type TicketStatus } from '@/core/constants/tickets';
import { TicketCard } from '@/features/tickets/components/ticket-card';
import {
  loadTenantTenancyOptions,
  loadTenantTicketsBoard,
  type TicketWithContext,
} from '@/features/tickets/loaders';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Tenant maintenance hub.
 *
 * Two-column-ish layout that reads top-to-bottom on mobile:
 *   - Header with "Raise an issue" CTA
 *   - "Open" section listing currently-active tickets
 *   - "History" section for resolved/closed/cancelled tickets
 *
 * If the tenant has no tickets at all we show the friendly empty state
 * instead of two empty buckets.
 */
export default async function TenantTicketsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/tenant/tickets');

  const [{ tickets, stats }, tenancies] = await Promise.all([
    loadTenantTicketsBoard(user.id),
    loadTenantTenancyOptions(user.id),
  ]);

  const openStatuses = new Set<TicketStatus>(TICKET_OPEN_STATUSES);
  const open: TicketWithContext[] = [];
  const history: TicketWithContext[] = [];
  for (const t of tickets) {
    if (openStatuses.has(t.status)) open.push(t);
    else history.push(t);
  }

  const canRaise = tenancies.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Maintenance</h1>
          <p className="text-sm text-muted-foreground">
            Tell your landlord about issues, share photos, and track progress in one place.
          </p>
        </div>
        {canRaise ? (
          <Button asChild>
            <Link href="/tenant/tickets/new">Raise an issue</Link>
          </Button>
        ) : null}
      </header>

      {tickets.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-6 w-6" />}
          title={canRaise ? 'No tickets yet' : 'You can raise issues once your tenancy is active'}
          description={
            canRaise
              ? 'When something needs fixing in your home, raise an issue and your landlord will be notified straight away.'
              : 'Once you accept your tenancy invite, you can raise maintenance issues here.'
          }
          cta={canRaise ? { label: 'Raise an issue', href: '/tenant/tickets/new' } : undefined}
        />
      ) : (
        <div className="space-y-6">
          <section
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            aria-label="Maintenance summary"
          >
            <SummaryCell label="Open" value={stats.openCount} />
            <SummaryCell
              label="Critical open"
              value={stats.criticalOpen}
              tone={stats.criticalOpen > 0 ? 'text-red-700 dark:text-red-300' : ''}
            />
            <SummaryCell label="Awaiting you" value={stats.awaitingTenant} />
            <SummaryCell label="Resolved (7d)" value={stats.resolvedThisWeek} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Open ({open.length})
            </h2>
            {open.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Nothing open right now.
                </CardContent>
              </Card>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {open.map((t) => (
                  <li key={t.id}>
                    <TicketCard ticket={t} href={`/tenant/tickets/${t.id}`} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {history.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                History ({history.length})
              </h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {history.map((t) => (
                  <li key={t.id}>
                    <TicketCard ticket={t} href={`/tenant/tickets/${t.id}`} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SummaryCell({ label, value, tone = '' }: { label: string; value: number; tone?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
