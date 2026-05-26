import { AlertCircle, CheckCircle2, Clock, Heart } from 'lucide-react';
import { redirect } from 'next/navigation';
import { AvRow } from '@/components/ds/av-row';
import { KpiCard } from '@/components/ds/kpi-card';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AdminListQuery } from '@/core/schemas/admin';
import { AdminPagination } from '@/features/admin/components/admin-pagination';
import { AdminSearchInput } from '@/features/admin/components/admin-search-input';
import { AdminFilterRow, AdminTabBar } from '@/features/admin/components/ds';
import { buildExportQuery, ExportCsvLink } from '@/features/admin/components/export-csv-link';
import { FilterSelect } from '@/features/admin/components/filter-select';
import { TicketRowActions } from '@/features/admin/components/ticket-row-actions';
import {
  getAdminSelf,
  hasAdminRole,
  type ListSupportParams,
  listSupportTicketsWithClient,
  loadAdminCsat,
  loadAdminTicketResponseStats,
} from '@/features/admin/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    q?: string;
    tab?: string;
    priority?: string;
    assignee?: string;
    page?: string;
    per_page?: string;
  }>;
}

const TABS: { id: NonNullable<ListSupportParams['filter']>; label: string }[] = [
  { id: 'all', label: 'All open' },
  { id: 'high', label: 'High priority' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'resolved', label: 'Resolved' },
];

/**
 * /admin/support — Tenantly platform support tickets.
 *
 * Distinct from the per-org maintenance tickets in `public.tickets` —
 * these are landlord-to-platform issues (bugs, integrations, billing
 * help). Read via `platform_support_tickets`; write actions are gated
 * to `super` / `support` roles.
 */
export default async function AdminSupportPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin/support');

  const self = await getAdminSelf(supabase, user.id);
  const canEdit = hasAdminRole(self, ['super', 'support']);

  const sp = await searchParams;
  const params = AdminListQuery.parse({
    q: sp.q,
    page: sp.page,
    per_page: sp.per_page,
  });
  const tab = (sp.tab as ListSupportParams['filter']) ?? 'all';
  const priority = (sp.priority as ListSupportParams['priority']) ?? 'all';
  const assignee = sp.assignee ?? 'all';

  const [result, csat, response] = await Promise.all([
    listSupportTicketsWithClient(supabase, {
      q: params.q ?? null,
      filter: tab,
      priority,
      assignee,
      callerId: user.id,
      page: params.page,
      perPage: params.per_page,
    }),
    loadAdminCsat(supabase),
    loadAdminTicketResponseStats(supabase),
  ]);

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Support tickets' }]}
        title="Support tickets"
        description={
          <>
            {result.open_total} open · {result.resolved_week_total} resolved this week.
          </>
        }
        actions={
          <ExportCsvLink
            href={`/api/admin/support/export.csv${buildExportQuery({
              q: params.q,
              tab,
              priority,
              assignee,
            })}`}
            label="Export"
          />
        }
      />

      <ResponsiveGrid preset="kpi-5">
        <KpiCard
          accent="red"
          icon={<AlertCircle />}
          label="Open tickets"
          value={result.open_total.toString()}
          delta={result.open_total > 0 ? { value: 'Open', tone: 'down' } : undefined}
        />
        <KpiCard
          accent="amber"
          icon={<Clock />}
          label="High priority"
          value={result.high_total.toString()}
          delta={result.high_total > 0 ? { value: 'Urgent', tone: 'warn' } : undefined}
        />
        <KpiCard
          accent="forest"
          icon={<CheckCircle2 />}
          label="Resolved this week"
          value={result.resolved_week_total.toString()}
          delta={{ value: 'Week', tone: 'up' }}
        />
        <KpiCard
          accent="blue"
          icon={<Clock />}
          label="Avg first response"
          value={formatResponse(response.avg_minutes)}
          sublabel={
            response.sample_size > 0
              ? `${response.sample_size} replies in 30 days`
              : 'No replies yet'
          }
        />
        <KpiCard
          accent="purple"
          icon={<Heart />}
          label="CSAT satisfaction"
          value={csat.csat_pct !== null ? `${csat.csat_pct}%` : '—'}
          delta={
            csat.csat_pct !== null
              ? csat.csat_pct >= 80
                ? { value: 'Score', tone: 'up' }
                : { value: 'Watch', tone: 'warn' }
              : undefined
          }
          sublabel={csat.sample_size > 0 ? `${csat.sample_size} ratings` : 'Awaiting feedback'}
        />
      </ResponsiveGrid>

      <AdminTabBar
        activeId={tab ?? 'all'}
        items={TABS.map((t) => ({
          id: t.id,
          label: t.label,
          href: buildTabHref(t.id, params.q, priority, assignee),
          count:
            t.id === 'all'
              ? result.open_total
              : t.id === 'high'
                ? result.high_total
                : t.id === 'unassigned'
                  ? result.unassigned_total
                  : result.resolved_week_total,
        }))}
      />

      <Card>
        <CardContent className="space-y-4 p-4 lg:p-5">
          <AdminFilterRow>
            <div className="min-w-0 flex-1 sm:max-w-xs">
              <AdminSearchInput
                basePath="/admin/support"
                initialValue={params.q ?? ''}
                placeholder="Search ticket title or description…"
              />
            </div>
            <FilterSelect
              name="priority"
              value={priority ?? 'all'}
              basePath="/admin/support"
              preserve={['q', 'tab', 'assignee']}
            >
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="med">Medium</option>
              <option value="low">Low</option>
            </FilterSelect>
            <FilterSelect
              name="assignee"
              value={assignee}
              basePath="/admin/support"
              preserve={['q', 'tab', 'priority']}
            >
              <option value="all">Assignee: all</option>
              <option value="me">Me</option>
              <option value="unassigned">Unassigned</option>
            </FilterSelect>
          </AdminFilterRow>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-page text-left text-[11px] font-bold uppercase tracking-wider text-ink-light">
                <tr>
                  <th className="px-3 py-2.5 font-bold">Ticket</th>
                  <th className="px-3 py-2.5 font-bold">Landlord</th>
                  <th className="px-3 py-2.5 font-bold">Category</th>
                  <th className="px-3 py-2.5 font-bold">Assigned to</th>
                  <th className="px-3 py-2.5 font-bold">Priority</th>
                  <th className="px-3 py-2.5 font-bold">Age</th>
                  <th className="px-3 py-2.5 font-bold">Status</th>
                  <th className="px-3 py-2.5 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-[13px] text-ink-light" colSpan={8}>
                      No tickets match this view.
                    </td>
                  </tr>
                ) : (
                  result.rows.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border-soft transition-colors last:border-b-0 hover:bg-foam/60"
                    >
                      <td className="px-3 py-3">
                        <div className="font-semibold text-ink">
                          #{t.ref_number} — {t.title}
                        </div>
                        {t.description ? (
                          <div className="line-clamp-1 text-[11.5px] text-ink-light">
                            {t.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <AvRow
                          size="sm"
                          name={t.reporter_name ?? t.reporter_email ?? '—'}
                          sub={t.org_name ?? undefined}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <CategoryBadge category={t.category} />
                      </td>
                      <td className="px-3 py-3 text-[12.5px] text-ink">
                        {t.assignee_name ?? <span className="text-ink-light">Unassigned</span>}
                      </td>
                      <td className="px-3 py-3">
                        <PriorityPill priority={t.priority} />
                      </td>
                      <td className="px-3 py-3 text-[12px] text-ink-light">
                        {formatAge(t.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={t.status} />
                      </td>
                      <td className="px-3 py-3">
                        <TicketRowActions
                          ticketId={t.id}
                          isResolved={t.status === 'resolved'}
                          isAssignedToMe={t.assigned_to === user.id}
                          canEdit={canEdit}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 lg:hidden">
            {result.rows.length === 0 ? (
              <p className="text-[13px] text-ink-light">No tickets match this view.</p>
            ) : (
              result.rows.map((t) => (
                <div key={t.id} className="rounded-card border border-border-soft bg-white p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-ink">
                        #{t.ref_number} {t.title}
                      </div>
                      <div className="text-[11.5px] text-ink-light">
                        {t.reporter_name ?? '—'}
                        {t.org_name ? ` · ${t.org_name}` : ''}
                      </div>
                    </div>
                    <PriorityPill priority={t.priority} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <StatusPill status={t.status} />
                    <TicketRowActions
                      ticketId={t.id}
                      isResolved={t.status === 'resolved'}
                      isAssignedToMe={t.assigned_to === user.id}
                      canEdit={canEdit}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <AdminPagination
            basePath="/admin/support"
            page={result.page}
            totalPages={result.total_pages}
            preservedParams={{
              q: params.q,
              tab: tab === 'all' ? undefined : (tab ?? undefined),
              priority: priority === 'all' ? undefined : (priority ?? undefined),
              assignee: assignee === 'all' ? undefined : assignee,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function buildTabHref(
  tab: string,
  q?: string | null,
  priority?: string | null,
  assignee?: string | null,
): string {
  const sp = new URLSearchParams();
  if (tab !== 'all') sp.set('tab', tab);
  if (q) sp.set('q', q);
  if (priority && priority !== 'all') sp.set('priority', priority);
  if (assignee && assignee !== 'all') sp.set('assignee', assignee);
  const s = sp.toString();
  return s ? `/admin/support?${s}` : '/admin/support';
}

function CategoryBadge({ category }: { category: string }) {
  const palette: Record<string, 'neutral' | 'warning' | 'info' | 'success'> = {
    bug: 'warning',
    integration: 'info',
    email: 'info',
    reports: 'neutral',
    billing: 'success',
    other: 'neutral',
  };
  return (
    <Badge variant={palette[category] ?? 'neutral'} className="capitalize">
      {category}
    </Badge>
  );
}

function PriorityPill({ priority }: { priority: 'low' | 'med' | 'high' }) {
  if (priority === 'high') return <Badge variant="urgent">High</Badge>;
  if (priority === 'med') return <Badge variant="warning">Medium</Badge>;
  return <Badge variant="neutral">Low</Badge>;
}

function StatusPill({ status }: { status: 'open' | 'in_progress' | 'resolved' }) {
  if (status === 'open') return <Badge variant="urgent">Open</Badge>;
  if (status === 'in_progress') return <Badge variant="warning">In progress</Badge>;
  return <Badge variant="success">Resolved</Badge>;
}

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function formatResponse(avgMinutes: number | null): string {
  if (avgMinutes === null) return '—';
  if (avgMinutes < 60) return `${avgMinutes}m`;
  const hours = Math.floor(avgMinutes / 60);
  const mins = avgMinutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}
