import { CheckCircle2, Clock, Star, Wrench } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { DataTable, KpiCard, PageHeader, SectionCard, TabBar } from '@/components/ds';
import { TICKET_CATEGORY_RULES, type TicketStatus } from '@/core/constants/tickets';
import { ReportIssueButton } from '@/features/tenant-dashboard/components/report-issue-button';
import {
  loadTenantTenancyOptions,
  loadTenantTicketsBoard,
  type TicketWithContext,
} from '@/features/tickets/loaders';
import { summariseTenantTickets } from '@/features/tickets/summarise-tenant-tickets';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const TAB_FILTERS: Record<string, (status: TicketStatus) => boolean> = {
  all: () => true,
  open: (s) => s === 'open' || s === 'triaged',
  in_progress: (s) => s === 'in_progress' || s === 'awaiting_tenant' || s === 'awaiting_contractor',
  resolved: (s) => s === 'resolved' || s === 'closed',
};

const STATUS_LABEL: Record<TicketStatus, { label: string; classes: string }> = {
  open: { label: 'Open', classes: 'bg-alert-bg text-alert' },
  triaged: { label: 'Triaged', classes: 'bg-blue-bg text-blue' },
  in_progress: { label: 'In progress', classes: 'bg-blue-bg text-blue' },
  awaiting_tenant: { label: 'Needs you', classes: 'bg-amber-bg text-amber' },
  awaiting_contractor: { label: 'Awaiting fix', classes: 'bg-amber-bg text-amber' },
  resolved: { label: 'Resolved', classes: 'bg-forest-100 text-forest-700' },
  closed: { label: 'Closed', classes: 'bg-foam text-forest-700' },
  cancelled: { label: 'Cancelled', classes: 'bg-foam text-ink-light' },
};

/**
 * `/tenant/tickets` — HMOeez redesign of the maintenance hub.
 *
 *  - PageHeader with "Report an issue" CTA (opens modal — keeps
 *    `/tenant/tickets/new` reachable for deep links).
 *  - 4-tile KPI strip: open / resolved total / avg resolution / landlord rating.
 *  - Pill-style TabBar (All / Open / In progress / Resolved) wired to `?tab=`.
 *  - Flat DataTable with row-href to `/tenant/tickets/[ticketId]`.
 */
export default async function TenantMaintenancePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/tenant/tickets');

  const sp = (await searchParams) ?? {};
  const activeTab = sp.tab && TAB_FILTERS[sp.tab] ? sp.tab : 'all';

  const [{ tickets }, tenancyOptions] = await Promise.all([
    loadTenantTicketsBoard(user.id),
    loadTenantTenancyOptions(user.id),
  ]);

  const summary = summariseTenantTickets(tickets);
  const filtered = tickets.filter((t) => TAB_FILTERS[activeTab]?.(t.status) ?? true);

  const canReport = tenancyOptions.length > 0;

  if (tickets.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <PageHeader
          breadcrumbs={[{ label: 'Tenant', href: '/tenant' }, { label: 'Maintenance' }]}
          title="Maintenance"
          description="Report issues and track repair progress."
          actions={
            canReport ? (
              <ReportIssueButton tenancies={tenancyOptions} redirectBase="/tenant/tickets" />
            ) : null
          }
        />
        <EmptyState
          icon={<Wrench className="h-6 w-6" />}
          title={canReport ? 'No tickets yet' : 'You can raise issues once your tenancy is active'}
          description={
            canReport
              ? 'When something needs fixing, report an issue and your landlord will be notified straight away.'
              : 'Once you accept your tenancy invite, you can raise maintenance issues here.'
          }
        />
      </div>
    );
  }

  const stars = summary.landlordResponseStars;
  const starString = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Tenant', href: '/tenant' }, { label: 'Maintenance' }]}
        title="Maintenance"
        description="Report issues and track repair progress."
        actions={
          canReport ? (
            <ReportIssueButton tenancies={tenancyOptions} redirectBase="/tenant/tickets" />
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Open requests"
          value={String(summary.openCount + summary.inProgressCount)}
          icon={<Clock />}
          accent="blue"
          delta={{ value: 'Active', tone: 'info' }}
        />
        <KpiCard
          label="Resolved total"
          value={String(summary.resolvedCount)}
          icon={<CheckCircle2 />}
          accent="forest"
          delta={{ value: 'Done', tone: 'up' }}
        />
        <KpiCard
          label="Avg resolution time"
          value={summary.avgResolutionDays != null ? `${summary.avgResolutionDays}d` : '—'}
          icon={<Clock />}
          accent="forest"
          delta={summary.avgResolutionDays != null ? { value: 'Avg', tone: 'up' } : undefined}
        />
        <KpiCard
          label="Landlord response"
          value={
            <span
              role="img"
              aria-label={`${stars} out of 5 stars`}
              className="text-amber tracking-wider"
            >
              {stars > 0 ? starString : '—'}
            </span>
          }
          icon={<Star />}
          accent="forest"
          delta={stars > 0 ? { value: 'Score', tone: 'up' } : undefined}
        />
      </div>

      <TabBar
        activeId={activeTab}
        items={[
          { id: 'all', label: 'All', href: '/tenant/tickets', count: summary.total },
          {
            id: 'open',
            label: 'Open',
            href: '/tenant/tickets?tab=open',
            count: summary.openCount,
          },
          {
            id: 'in_progress',
            label: 'In progress',
            href: '/tenant/tickets?tab=in_progress',
            count: summary.inProgressCount,
          },
          {
            id: 'resolved',
            label: 'Resolved',
            href: '/tenant/tickets?tab=resolved',
            count: summary.resolvedCount,
          },
        ]}
      />

      <SectionCard padded={false}>
        <DataTable<TicketWithContext>
          rowKey={(t) => t.id}
          rows={filtered}
          rowHref={(t) => `/tenant/tickets/${t.id}`}
          emptyState={
            <p className="text-[13px] text-ink-light">
              Nothing in this tab. Try a different filter or report a new issue.
            </p>
          }
          columns={[
            {
              id: 'issue',
              header: 'Issue',
              mobile: 'primary',
              cell: (t) => (
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-ink">{t.title}</div>
                  {t.description ? (
                    <div className="mt-0.5 line-clamp-1 text-[11.5px] text-ink-light">
                      {t.description}
                    </div>
                  ) : null}
                </div>
              ),
            },
            {
              id: 'category',
              header: 'Category',
              cell: (t) => (
                <span className="inline-flex items-center rounded-full bg-foam px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-forest-700">
                  {TICKET_CATEGORY_RULES[t.category]?.label ?? t.category}
                </span>
              ),
              hideMd: true,
            },
            {
              id: 'reported',
              header: 'Reported',
              mobile: 'secondary',
              cell: (t) => shortDate(t.created_at),
            },
            {
              id: 'updated',
              header: 'Last update',
              cell: (t) => shortDate(t.updated_at ?? t.created_at),
              hideMd: true,
            },
            {
              id: 'assigned',
              header: 'Assigned to',
              cell: (t) => (
                <span className="text-[12.5px] text-ink-light">
                  {t.assigned_contractor ?? (t.assigned_to_user_id ? 'Landlord' : '—')}
                </span>
              ),
              hideMd: true,
            },
            {
              id: 'status',
              header: 'Status',
              mobile: 'meta',
              cell: (t) => {
                const meta = STATUS_LABEL[t.status];
                return (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider',
                      meta.classes,
                    )}
                  >
                    {meta.label}
                  </span>
                );
              },
            },
            {
              id: 'view',
              header: '',
              align: 'right',
              cell: () => (
                <Link
                  href="#"
                  className="text-[12px] font-semibold text-forest-700 hover:underline"
                  aria-label="Open ticket"
                >
                  View →
                </Link>
              ),
            },
          ]}
        />
      </SectionCard>
    </div>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
