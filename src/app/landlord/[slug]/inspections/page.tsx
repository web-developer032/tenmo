import { CalendarCheck, CheckCircle2, ClipboardList, ShieldCheck } from 'lucide-react';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { type Column, DataTable } from '@/components/ds/data-table';
import { KpiCard } from '@/components/ds/kpi-card';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { SectionCard } from '@/components/ds/section-card';
import { TabBar, type TabItem } from '@/components/ds/tab-bar';
import { ScheduleInspectionModal } from '@/features/inspections/components/schedule-inspection-modal';
import {
  type InspectionOutcome,
  type InspectionRow,
  type InspectionType,
  loadLandlordInspections,
} from '@/features/inspections/load-landlord-inspections';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };
type Search = { tab?: 'all' | 'upcoming' | 'completed' | 'overdue' };

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<InspectionType, string> = {
  routine_quarterly: 'Routine quarterly',
  move_in: 'Move-in inspection',
  move_out: 'Move-out inspection',
  interim: 'Interim',
  compliance: 'Compliance check',
};

const OUTCOME_LABELS: Record<InspectionOutcome, string> = {
  no_issues: 'No issues',
  minor: 'Minor findings',
  major: 'Major findings',
  fail: 'Failed',
};

export default async function LandlordInspectionsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<Search>;
}) {
  const { slug } = await params;
  const { tab = 'all' } = (await searchParams) ?? {};
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const supabase = await createClient();
  const [{ rows, kpis }, { data: properties }] = await Promise.all([
    loadLandlordInspections(supabase, org.id),
    supabase.from('properties').select('id, name').eq('org_id', org.id).order('name'),
  ]);

  const tabs: TabItem[] = [
    { id: 'all', label: 'All', count: rows.length, href: `/landlord/${slug}/inspections` },
    {
      id: 'upcoming',
      label: 'Upcoming',
      count: kpis.upcoming,
      href: `/landlord/${slug}/inspections?tab=upcoming`,
    },
    {
      id: 'completed',
      label: 'Completed',
      count: rows.filter((r) => r.status === 'completed').length,
      href: `/landlord/${slug}/inspections?tab=completed`,
    },
    {
      id: 'overdue',
      label: 'Overdue',
      count: kpis.overdue,
      href: `/landlord/${slug}/inspections?tab=overdue`,
    },
  ];

  const filtered = rows.filter((r) => {
    if (tab === 'all') return true;
    if (tab === 'upcoming') return r.status === 'scheduled';
    if (tab === 'completed') return r.status === 'completed';
    if (tab === 'overdue') return r.status === 'overdue';
    return true;
  });

  const columns: Column<InspectionRow>[] = [
    {
      id: 'property',
      header: 'Property',
      mobile: 'primary',
      cell: (r) => <strong className="text-ink">{r.propertyName}</strong>,
    },
    {
      id: 'type',
      header: 'Type',
      mobile: 'secondary',
      cell: (r) => TYPE_LABELS[r.type] ?? r.type,
    },
    {
      id: 'date',
      header: 'Scheduled',
      cell: (r) => (
        <span className={cn('font-medium', r.status === 'overdue' ? 'text-alert' : 'text-ink')}>
          {fmtShort(r.scheduledFor)}
        </span>
      ),
    },
    {
      id: 'inspector',
      header: 'Inspector',
      cell: (r) => r.inspectorName ?? 'Self',
    },
    {
      id: 'notified',
      header: 'Tenant notified',
      cell: (r) =>
        r.tenantNotifiedAt ? (
          <span className="inline-flex items-center rounded-full bg-foam px-2.5 py-0.5 text-[11px] font-bold text-forest-700">
            Yes
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-amber-bg px-2.5 py-0.5 text-[11px] font-bold text-amber">
            Pending
          </span>
        ),
    },
    {
      id: 'outcome',
      header: 'Outcome',
      cell: (r) => (r.outcome ? OUTCOME_LABELS[r.outcome] : '—'),
    },
    {
      id: 'status',
      header: 'Status',
      mobile: 'meta',
      cell: (r) => <InspectionStatusPill status={r.status} />,
    },
    {
      id: 'report',
      header: 'Report',
      cell: (r) =>
        r.reportDocumentId ? (
          <span className="text-[12px] font-semibold text-blue">View report</span>
        ) : (
          <span className="text-[12px] text-ink-light">—</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (r) =>
        r.status === 'overdue' ? (
          <span className="text-[12.5px] font-semibold text-alert">Log now →</span>
        ) : r.status === 'scheduled' ? (
          <span className="text-[12.5px] font-semibold text-forest-600">Reschedule →</span>
        ) : (
          <span className="text-[12.5px] font-semibold text-forest-600">View →</span>
        ),
    },
  ];

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Inspections' },
        ]}
        title="Inspections"
        description="Schedule and log property inspections across your portfolio"
        actions={<ScheduleInspectionModal slug={slug} properties={properties ?? []} />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="No inspections logged yet"
          description="Schedule your first inspection — we'll track tenant notice, outcome and the next quarter for you."
        />
      ) : (
        <>
          <ResponsiveGrid preset="kpi" aria-label="Inspections summary">
            <KpiCard
              label="Upcoming inspections"
              value={kpis.upcoming}
              accent="amber"
              icon={<CalendarCheck />}
              delta={{ tone: 'warn', value: 'Scheduled' }}
            />
            <KpiCard
              label="Overdue inspections"
              value={kpis.overdue}
              accent={kpis.overdue > 0 ? 'red' : 'forest'}
              icon={<ClipboardList />}
              delta={
                kpis.overdue > 0
                  ? { tone: 'down', value: 'Overdue' }
                  : { tone: 'up', value: 'On track' }
              }
            />
            <KpiCard
              label="Completed this year"
              value={kpis.completedYtd}
              accent="forest"
              icon={<CheckCircle2 />}
              delta={{ tone: 'up', value: 'YTD' }}
            />
            <KpiCard
              label="No issues found"
              value={`${kpis.passRatePercent}%`}
              accent="forest"
              icon={<ShieldCheck />}
              delta={{ tone: 'up', value: 'Pass rate' }}
            />
          </ResponsiveGrid>

          <TabBar items={tabs} activeId={tab} />
          <SectionCard padded={false} title="Scheduled & recent inspections">
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(r) => r.id}
              emptyState={
                <p className="text-[13px] text-ink-light">No inspections match this filter.</p>
              }
              className="border-0 lg:rounded-none lg:border-0"
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}

function InspectionStatusPill({ status }: { status: InspectionRow['status'] }) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold';
  switch (status) {
    case 'scheduled':
      return <span className={cn(base, 'bg-amber-bg text-amber')}>Upcoming</span>;
    case 'completed':
      return <span className={cn(base, 'bg-foam text-forest-700')}>Completed</span>;
    case 'overdue':
      return <span className={cn(base, 'bg-alert-bg text-alert')}>Overdue</span>;
    case 'cancelled':
      return <span className={cn(base, 'bg-sand text-ink-mid')}>Cancelled</span>;
    default:
      return <span className={cn(base, 'bg-sand text-ink-mid')}>{status}</span>;
  }
}

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
