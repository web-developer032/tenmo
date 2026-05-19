import { Wrench } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    <div className="mx-auto w-full max-w-5xl space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Tenant', href: '/tenant' }, { label: 'Maintenance' }]}
        title="Maintenance"
        description="Tell your landlord about issues, share photos, and track progress in one place."
        actions={
          canRaise ? (
            <Button asChild>
              <Link href="/tenant/tickets/new">Raise an issue</Link>
            </Button>
          ) : null
        }
      />

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
          <ResponsiveGrid preset="kpi" aria-label="Maintenance summary">
            <SummaryCell label="Open" value={stats.openCount} />
            <SummaryCell
              label="Critical open"
              value={stats.criticalOpen}
              tone={stats.criticalOpen > 0 ? 'text-alert' : ''}
            />
            <SummaryCell label="Awaiting you" value={stats.awaitingTenant} />
            <SummaryCell label="Resolved (7d)" value={stats.resolvedThisWeek} />
          </ResponsiveGrid>

          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-light">
              Open ({open.length})
            </h2>
            {open.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-[13px] text-ink-light">
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
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-light">
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
      <CardContent className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-light">{label}</p>
        <p className={`font-sans text-[26px] font-extrabold text-ink ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
