import { AlertTriangle, Wrench } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Maintenance' },
        ]}
        title="Maintenance"
        description="Triage incoming tenant tickets, dispatch contractors and keep the loop tight. SLAs are tracked automatically based on severity."
      />

      {isEmpty ? (
        <EmptyState
          icon={<Wrench className="h-6 w-6" />}
          title="No tickets yet"
          description="Once your tenants start raising issues, they'll appear here. You'll get an email the moment a critical ticket is logged."
        />
      ) : (
        <>
          <ResponsiveGrid preset="kpi" aria-label="Maintenance summary">
            <Stat label="Open" value={stats.openCount} />
            <Stat
              label="Critical open"
              value={stats.criticalOpen}
              tone={stats.criticalOpen > 0 ? 'text-alert' : ''}
            />
            <Stat
              label="SLA breached"
              value={stats.breachedSla}
              tone={stats.breachedSla > 0 ? 'text-alert' : ''}
            />
            <Stat label="Resolved (7d)" value={stats.resolvedThisWeek} />
          </ResponsiveGrid>

          {critical.length > 0 ? (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-light">
                <AlertTriangle className="h-4 w-4 text-alert" />
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
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-light">Board</h2>
            <TicketKanban byStatus={byStatus} orgSlug={slug} />
          </section>

          {history.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink-light">
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
      <CardContent className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-light">{label}</p>
        <p className={`font-sans text-[26px] font-extrabold text-ink ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
