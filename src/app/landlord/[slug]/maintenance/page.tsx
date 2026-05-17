import { AlertTriangle, Wrench } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { TicketCard } from '@/features/tickets/components/ticket-card';
import { TicketKanban } from '@/features/tickets/components/ticket-kanban';
import { loadOrgTicketsBoard } from '@/features/tickets/loaders';

type Params = { slug: string };

export const dynamic = 'force-dynamic';

/**
 * Landlord maintenance dashboard.
 *
 * Layout:
 *   [ Hero stats: open / critical / awaiting / breached ]
 *   [ Critical attention strip (if any) ]
 *   [ Kanban board for all open work ]
 *   [ History — recently resolved/closed/cancelled ]
 *
 * Tenants never see this page (route is under /landlord/*). Org membership
 * is enforced by the layout; data is RLS-scoped to the org.
 */
export default async function LandlordMaintenancePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const { tickets, byStatus, stats } = await loadOrgTicketsBoard(org.id);

  const isEmpty = tickets.length === 0;
  const critical = tickets.filter(
    (t) => t.severity === 'critical' && t.status !== 'closed' && t.status !== 'cancelled',
  );
  const history = [...(byStatus.closed ?? []), ...(byStatus.cancelled ?? [])].slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Maintenance</h1>
          <p className="text-sm text-muted-foreground">
            Triage incoming tenant tickets, dispatch contractors and keep the loop tight. SLAs are
            tracked automatically based on severity.
          </p>
        </div>
      </header>

      {isEmpty ? (
        <EmptyState
          icon={<Wrench className="h-6 w-6" />}
          title="No tickets yet"
          description="Once your tenants start raising issues, they'll appear here. You'll get an email the moment a critical ticket is logged."
        />
      ) : (
        <>
          <section
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            aria-label="Maintenance summary"
          >
            <Stat label="Open" value={stats.openCount} />
            <Stat
              label="Critical open"
              value={stats.criticalOpen}
              tone={stats.criticalOpen > 0 ? 'text-red-700 dark:text-red-300' : ''}
            />
            <Stat
              label="SLA breached"
              value={stats.breachedSla}
              tone={stats.breachedSla > 0 ? 'text-red-700 dark:text-red-300' : ''}
            />
            <Stat label="Resolved (7d)" value={stats.resolvedThisWeek} />
          </section>

          {critical.length > 0 ? (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Needs immediate attention
              </h2>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {critical.slice(0, 6).map((t) => (
                  <li key={t.id}>
                    <TicketCard
                      ticket={t}
                      href={`/landlord/${slug}/maintenance/${t.id}`}
                      showTenant
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Board
            </h2>
            <TicketKanban byStatus={byStatus} orgSlug={slug} />
          </section>

          {history.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Recently completed
                </h2>
                {history.length === 6 ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/landlord/${slug}/maintenance/history`}>View all</Link>
                  </Button>
                ) : null}
              </div>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {history.map((t) => (
                  <li key={t.id}>
                    <TicketCard
                      ticket={t}
                      href={`/landlord/${slug}/maintenance/${t.id}`}
                      showTenant
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone = '' }: { label: string; value: number; tone?: string }) {
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
