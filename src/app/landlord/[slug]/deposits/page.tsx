import { CheckCircle2, FileText, PiggyBank, ShieldCheck } from 'lucide-react';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { type Column, DataTable } from '@/components/ds/data-table';
import { KpiCard } from '@/components/ds/kpi-card';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { SectionCard } from '@/components/ds/section-card';
import { RecordDepositModal } from '@/features/deposits/components/record-deposit-modal';
import { type DepositRow, loadLandlordDeposits } from '@/features/deposits/load-landlord-deposits';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };

export const dynamic = 'force-dynamic';

const SCHEME_LABELS: Record<string, string> = {
  dps: 'DPS',
  mydeposits: 'mydeposits',
  tds: 'TDS',
};

export default async function LandlordDepositsPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const supabase = await createClient();
  const { rows, kpis } = await loadLandlordDeposits(supabase, org.id);

  const tenancyOptions = rows.map((r) => ({
    id: r.tenancyId,
    label: `${r.tenantName} · ${r.propertyName}${r.roomName ? ` · ${r.roomName}` : ''}`,
    defaultAmountPence: r.depositPence,
  }));

  const columns: Column<DepositRow>[] = [
    {
      id: 'tenant',
      header: 'Tenant',
      mobile: 'primary',
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ backgroundColor: r.tenantColour }}
            aria-hidden
          >
            {r.tenantInitials}
          </div>
          <span className="text-[13px] font-semibold text-ink">{r.tenantName}</span>
        </div>
      ),
    },
    {
      id: 'property',
      header: 'Property / Room',
      mobile: 'secondary',
      cell: (r) => (
        <span className="text-[13px] text-ink">
          {r.propertyName}
          {r.roomName ? ` · ${r.roomName}` : ''}
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (r) => <strong className="text-ink">{fmtMoney(r.depositPence)}</strong>,
    },
    {
      id: 'scheme',
      header: 'Scheme',
      cell: (r) => (r.scheme ? (SCHEME_LABELS[r.scheme] ?? r.scheme) : '—'),
    },
    {
      id: 'ref',
      header: 'Ref number',
      cell: (r) =>
        r.reference ? (
          <span className="text-[12px] text-blue">{r.reference}</span>
        ) : (
          <span className="text-ink-light">—</span>
        ),
    },
    {
      id: 'protected',
      header: 'Protected on',
      cell: (r) => (r.protectedAt ? fmtShort(r.protectedAt) : '—'),
    },
    {
      id: 'prescribed',
      header: 'Prescribed info',
      mobile: 'meta',
      cell: (r) =>
        r.prescribedInfoSentAt ? (
          <span className="inline-flex items-center rounded-full bg-foam px-2.5 py-0.5 text-[11px] font-bold text-forest-700">
            Sent
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-amber-bg px-2.5 py-0.5 text-[11px] font-bold text-amber">
            Pending
          </span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => <DepositStatusPill status={r.status} />,
    },
  ];

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Deposits' },
        ]}
        title="Deposits"
        description={
          rows.length === 0
            ? 'Track every tenancy deposit you hold — scheme, reference and protection deadlines all in one place.'
            : `${rows.length} active deposit${rows.length === 1 ? '' : 's'} · ${kpis.protectedCount} protected · ${kpis.unprotectedCount} unprotected`
        }
        actions={<RecordDepositModal slug={slug} tenancies={tenancyOptions} />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="h-6 w-6" />}
          title="No active deposits"
          description="Once you start a tenancy with a deposit, it will appear here for protection tracking."
        />
      ) : (
        <>
          <ResponsiveGrid preset="kpi" aria-label="Deposits summary">
            <KpiCard
              label="Total deposits held"
              value={fmtMoney(kpis.totalDepositsPence)}
              accent="forest"
              icon={<PiggyBank />}
              delta={{ tone: 'up', value: 'Held' }}
            />
            <KpiCard
              label="Protected"
              value={kpis.protectedCount}
              accent="forest"
              icon={<ShieldCheck />}
              delta={{ tone: 'up', value: 'DPS / mydeposits / TDS' }}
            />
            <KpiCard
              label="Unprotected / late"
              value={kpis.unprotectedCount}
              accent={kpis.unprotectedCount > 0 ? 'red' : 'forest'}
              icon={<CheckCircle2 />}
              delta={
                kpis.unprotectedCount > 0
                  ? { tone: 'down', value: 'Action needed' }
                  : { tone: 'up', value: 'On time' }
              }
            />
            <KpiCard
              label="Prescribed info sent"
              value={kpis.prescribedInfoSent}
              accent="blue"
              icon={<FileText />}
              delta={{ tone: 'info', value: 'Sent' }}
            />
          </ResponsiveGrid>

          <SectionCard
            padded={false}
            title="Deposit register"
            action={
              <a
                href={`/api/landlord/${slug}/rent/export`}
                className="text-[12.5px] font-semibold text-forest-600 hover:underline"
              >
                Export
              </a>
            }
          >
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.tenancyId}
              emptyState={
                <p className="text-[13px] text-ink-light">No deposits match this filter.</p>
              }
              className="border-0 lg:rounded-none lg:border-0"
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}

function DepositStatusPill({ status }: { status: DepositRow['status'] }) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold';
  switch (status) {
    case 'protected':
      return <span className={cn(base, 'bg-foam text-forest-700')}>Protected</span>;
    case 'returning':
      return <span className={cn(base, 'bg-amber-bg text-amber')}>Ending soon</span>;
    case 'late':
      return <span className={cn(base, 'bg-alert-bg text-alert')}>Late</span>;
    case 'ended':
      return <span className={cn(base, 'bg-sand text-ink-mid')}>Ended</span>;
    default:
      return <span className={cn(base, 'bg-amber-bg text-amber')}>Unprotected</span>;
  }
}

function fmtMoney(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
