import { AlertTriangle, Plus, Wrench } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { type Column, DataTable } from '@/components/ds/data-table';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { SectionCard } from '@/components/ds/section-card';
import { TabBar, type TabItem } from '@/components/ds/tab-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { TicketCard } from '@/features/tickets/components/ticket-card';
import { TicketKanban } from '@/features/tickets/components/ticket-kanban';
import { loadOrgTicketsBoard, type TicketWithContext } from '@/features/tickets/loaders';
import { cn } from '@/lib/cn';

type Params = { slug: string };
type Search = { view?: 'board' | 'list'; tab?: string };

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  heating_hot_water: 'Heating',
  security: 'Security',
  appliances: 'Appliances',
  damp_mould: 'Damp / mould',
  pests: 'Pests',
  cleaning: 'Cleaning',
  general: 'General',
  other: 'Other',
};

export default async function LandlordMaintenancePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<Search>;
}) {
  const { slug } = await params;
  const { view = 'board', tab = 'all' } = (await searchParams) ?? {};
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
        description={
          isEmpty
            ? 'Triage incoming tenant tickets, dispatch contractors and keep the loop tight.'
            : `${stats.openCount} open · ${stats.criticalOpen} urgent · ${stats.breachedSla} SLA breached`
        }
        actions={
          <Button asChild>
            <Link href={`/landlord/${slug}/maintenance/new`}>
              <Plus className="h-4 w-4" /> Log new request
            </Link>
          </Button>
        }
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

          {critical.length > 0 && view === 'board' ? (
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

          <ViewTabs slug={slug} active={view} />

          {view === 'list' ? (
            <ListView slug={slug} tickets={tickets} activeTab={tab} />
          ) : (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-light">Board</h2>
              <TicketKanban byStatus={byStatus} orgSlug={slug} />
            </section>
          )}

          {history.length > 0 && view === 'board' ? (
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

function ViewTabs({ slug, active }: { slug: string; active: 'board' | 'list' }) {
  const items: TabItem[] = [
    { id: 'board', label: 'Board', href: `/landlord/${slug}/maintenance?view=board` },
    { id: 'list', label: 'List', href: `/landlord/${slug}/maintenance?view=list` },
  ];
  return <TabBar items={items} activeId={active} />;
}

function ListView({
  slug,
  tickets,
  activeTab,
}: {
  slug: string;
  tickets: TicketWithContext[];
  activeTab: string;
}) {
  const open = tickets.filter((t) => t.status === 'open');
  const inProgress = tickets.filter((t) => t.status === 'in_progress');
  const resolved = tickets.filter(
    (t) => t.status === 'resolved' || t.status === 'closed' || t.status === 'cancelled',
  );
  const urgent = tickets.filter(
    (t) => t.severity === 'critical' && t.status !== 'closed' && t.status !== 'cancelled',
  );

  const tabs: TabItem[] = [
    { id: 'all', label: 'All', count: tickets.length, href: listHref(slug, 'all') },
    { id: 'urgent', label: 'Urgent', count: urgent.length, href: listHref(slug, 'urgent') },
    {
      id: 'in_progress',
      label: 'In progress',
      count: inProgress.length,
      href: listHref(slug, 'in_progress'),
    },
    { id: 'open', label: 'Open', count: open.length, href: listHref(slug, 'open') },
    {
      id: 'resolved',
      label: 'Resolved',
      count: resolved.length,
      href: listHref(slug, 'resolved'),
    },
  ];

  const filtered = tickets.filter((t) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'urgent') return urgent.includes(t);
    if (activeTab === 'resolved') return resolved.includes(t);
    if (activeTab === 'open') return t.status === 'open';
    if (activeTab === 'in_progress') return t.status === 'in_progress';
    return true;
  });

  const columns: Column<TicketWithContext>[] = [
    {
      id: 'issue',
      header: 'Issue',
      mobile: 'primary',
      cell: (t) => <span className="font-semibold text-ink">{t.title}</span>,
    },
    {
      id: 'property',
      header: 'Property',
      mobile: 'secondary',
      cell: (t) => (
        <span className="text-ink">
          {t.property_name ?? 'Property'}
          {t.room_name ? ` · ${t.room_name}` : ''}
        </span>
      ),
    },
    {
      id: 'reporter',
      header: 'Reported by',
      cell: (t) => t.tenant_name ?? t.tenant_email ?? '—',
    },
    {
      id: 'category',
      header: 'Category',
      cell: (t) => CATEGORY_LABELS[t.category] ?? t.category,
    },
    {
      id: 'reported',
      header: 'Reported',
      cell: (t) => humaniseAgo(new Date(), new Date(t.created_at)),
    },
    {
      id: 'assigned',
      header: 'Assigned to',
      cell: (t) =>
        t.assigned_contractor || t.assigned_to_user_id ? (
          <span className="font-semibold text-forest-600">
            {t.assigned_contractor ?? 'Team member'}
          </span>
        ) : (
          <span className="text-ink-light">Unassigned</span>
        ),
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: (t) => <SeverityPill severity={t.severity} />,
    },
    {
      id: 'status',
      header: 'Status',
      mobile: 'meta',
      cell: (t) => <StatusPill status={t.status} />,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (_t) => <span className="text-[12.5px] font-semibold text-forest-600">View →</span>,
    },
  ];

  return (
    <div className="space-y-3">
      <TabBar items={tabs} activeId={activeTab} />
      <SectionCard padded={false}>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(t) => t.id}
          rowHref={(t) => `/landlord/${slug}/maintenance/${t.id}`}
          emptyState={<p className="text-[13px] text-ink-light">No tickets match this filter.</p>}
          className="border-0 lg:rounded-none lg:border-0"
        />
      </SectionCard>
    </div>
  );
}

function SeverityPill({ severity }: { severity: string }) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold';
  if (severity === 'critical' || severity === 'high')
    return <span className={cn(base, 'bg-alert-bg text-alert')}>Urgent</span>;
  if (severity === 'medium')
    return <span className={cn(base, 'bg-amber-bg text-amber')}>Medium</span>;
  return <span className={cn(base, 'bg-foam text-forest-700')}>Low</span>;
}

function StatusPill({ status }: { status: string }) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold';
  switch (status) {
    case 'open':
      return <span className={cn(base, 'bg-amber-bg text-amber')}>Open</span>;
    case 'in_progress':
      return <span className={cn(base, 'bg-blue-bg text-blue')}>In progress</span>;
    case 'resolved':
      return <span className={cn(base, 'bg-foam text-forest-700')}>Resolved</span>;
    case 'closed':
      return <span className={cn(base, 'bg-sand text-ink-mid')}>Closed</span>;
    case 'cancelled':
      return <span className={cn(base, 'bg-sand text-ink-mid')}>Cancelled</span>;
    default:
      return <span className={cn(base, 'bg-sand text-ink-mid')}>{status}</span>;
  }
}

function humaniseAgo(now: Date, t: Date): string {
  const diff = (now.getTime() - t.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 604_800) return `${Math.round(diff / 86_400)}d ago`;
  return `${Math.round(diff / 604_800)}w ago`;
}

function listHref(slug: string, tab: string): string {
  return `/landlord/${slug}/maintenance?view=list${tab === 'all' ? '' : `&tab=${tab}`}`;
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
