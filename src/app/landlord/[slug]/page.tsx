import {
  AlertTriangle,
  ArrowRight,
  Building2,
  DoorOpen,
  Home,
  ShieldCheck,
  Wallet,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type * as React from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { AvRow } from '@/components/ds/av-row';
import { type Column, DataTable } from '@/components/ds/data-table';
import { KpiCard } from '@/components/ds/kpi-card';
import { MiniStat, MiniStatList } from '@/components/ds/mini-stat';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { SectionCard } from '@/components/ds/section-card';
import { Button } from '@/components/ui/button';
import { formatMoneyShort, formatMoneyWhole } from '@/core/utils/money';
import {
  type DashboardAlert,
  type DashboardComplianceRow,
  type DashboardMaintenanceRow,
  type DashboardPropertyRow,
  type LandlordDashboard,
  loadLandlordDashboard,
  type RentRow,
} from '@/features/landlord-dashboard/load-landlord-dashboard';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };

export default async function LandlordDashboardPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/landlord/${slug}`);

  const { data: org } = await supabase
    .from('orgs')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle();
  if (!org) notFound();

  const dash = await loadLandlordDashboard(supabase, { orgId: org.id, userId: user.id });

  const isEmpty = dash.portfolio.propertiesCount === 0;
  if (isEmpty) {
    return (
      <div className="space-y-5">
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title={`Welcome to Tenantly, ${dash.greetingName}`}
          description="Tenantly is built around rooms as first-class entities. Add a property, then add the rooms inside it. We'll set up the right HMO compliance schedule automatically."
          cta={{ label: 'Add a property', href: `/landlord/${slug}/properties/new` }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashGreeting name={dash.greetingName} todayLabel={dash.todayLabel} />

      <ResponsiveGrid preset="kpi" aria-label="Overview metrics">
        <KpiCard
          label="Monthly rent collected"
          value={formatMoneyShort(dash.kpis.rentCollectedPence)}
          icon={<Wallet />}
          accent="forest"
          delta={
            dash.kpis.rentCollectedDeltaPence !== 0
              ? {
                  value: `${dash.kpis.rentCollectedDeltaPence > 0 ? '+' : ''}${formatMoneyShort(Math.abs(dash.kpis.rentCollectedDeltaPence))}`,
                  tone: dash.kpis.rentCollectedDeltaPence >= 0 ? 'up' : 'down',
                }
              : undefined
          }
        />
        <KpiCard
          label="Rooms occupied"
          value={
            <span>
              {dash.kpis.occupiedRooms}
              <span className="text-ink-light"> / {dash.kpis.totalRooms}</span>
            </span>
          }
          icon={<DoorOpen />}
          accent="amber"
          delta={
            dash.kpis.totalRooms > 0
              ? {
                  value: `${Math.round((dash.kpis.occupiedRooms / dash.kpis.totalRooms) * 100)}%`,
                  tone: 'up',
                }
              : undefined
          }
        />
        <KpiCard
          label="Open maintenance"
          value={dash.kpis.openTickets}
          icon={<Wrench />}
          accent={dash.kpis.openUrgent > 0 ? 'red' : 'forest'}
          delta={dash.kpis.openUrgent > 0 ? { value: 'Urgent', tone: 'down' } : undefined}
        />
        <KpiCard
          label="Compliance docs valid"
          value={
            <span>
              {dash.kpis.complianceValid}
              <span className="text-ink-light"> / {dash.kpis.complianceTotal}</span>
            </span>
          }
          icon={<ShieldCheck />}
          accent="blue"
          delta={
            dash.kpis.complianceAmber > 0
              ? { value: `${dash.kpis.complianceAmber} expiring`, tone: 'warn' }
              : undefined
          }
        />
      </ResponsiveGrid>

      <ResponsiveGrid preset="dash-2">
        <RentStatusCard
          slug={slug}
          monthLabel={dash.monthLabel}
          rows={dash.rentRows}
          overdueCount={dash.rentOverdueCount}
        />
        <div className="flex flex-col gap-4">
          <AlertsCard alerts={dash.alerts} />
          <PortfolioStatsCard portfolio={dash.portfolio} />
        </div>
      </ResponsiveGrid>

      <ResponsiveGrid preset="dash-3">
        <PropertiesSnapshotCard slug={slug} rows={dash.properties} />
        <MaintenanceSnapshotCard slug={slug} rows={dash.maintenance} />
        <ComplianceSnapshotCard slug={slug} rows={dash.compliance} />
      </ResponsiveGrid>
    </div>
  );
}

function DashGreeting({ name, todayLabel }: { name: string; todayLabel: string }) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <header>
      <h1 className="font-sans text-[24px] font-extrabold leading-tight tracking-tight text-ink lg:text-[26px]">
        {greet}, {name}
      </h1>
      <p className="mt-1 text-[13px] text-ink-light">
        Here&apos;s your portfolio snapshot for {todayLabel}.
      </p>
    </header>
  );
}

function RentStatusCard({
  slug,
  monthLabel,
  rows,
  overdueCount,
}: {
  slug: string;
  monthLabel: string;
  rows: RentRow[];
  overdueCount: number;
}) {
  const columns: Column<RentRow>[] = [
    {
      id: 'tenant',
      header: 'Tenant',
      mobile: 'primary',
      cell: (r) => (
        <AvRow
          name={r.tenantName}
          sub={r.tenantSince ? `Since ${r.tenantSince}` : undefined}
          size="sm"
        />
      ),
    },
    {
      id: 'where',
      header: 'Property / Room',
      mobile: 'secondary',
      cell: (r) => (
        <span className="text-ink">
          {r.propertyName}
          {r.roomName ? ` · ${r.roomName}` : ''}
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (r) => <span className="font-semibold">{formatMoneyWhole(r.amountPence)}</span>,
    },
    {
      id: 'due',
      header: 'Due',
      cell: (r) => new Date(r.dueDate).toLocaleString('en-GB', { day: 'numeric', month: 'short' }),
    },
    {
      id: 'status',
      header: 'Status',
      mobile: 'meta',
      align: 'right',
      cell: (r) => <RentStatusPill row={r} />,
    },
  ];

  return (
    <SectionCard
      title={`Rent status — ${monthLabel}`}
      padded={false}
      action={
        <div className="flex items-center gap-2">
          {overdueCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-alert-bg px-2.5 py-0.5 text-[11px] font-bold text-alert">
              {overdueCount} overdue
            </span>
          ) : null}
          <Link
            href={`/landlord/${slug}/finance`}
            className="text-[12.5px] font-semibold text-forest-600 hover:underline"
          >
            View all →
          </Link>
        </div>
      }
    >
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-[13px] text-ink-light">
          No charges raised for {monthLabel} yet.
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          emptyState={<p className="text-[13px] text-ink-light">No rent rows for {monthLabel}.</p>}
          className="border-0 lg:rounded-none lg:border-0"
        />
      )}
    </SectionCard>
  );
}

function RentStatusPill({ row }: { row: RentRow }) {
  if (row.status === 'paid') {
    return (
      <span className="inline-flex items-center rounded-full bg-foam px-2.5 py-0.5 text-[11px] font-bold text-forest-700">
        Paid
      </span>
    );
  }
  if (row.status === 'overdue') {
    return (
      <span className="inline-flex items-center rounded-full bg-alert-bg px-2.5 py-0.5 text-[11px] font-bold text-alert">
        {Math.abs(row.daysFromDue)}d overdue
      </span>
    );
  }
  if (row.status === 'due') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-bg px-2.5 py-0.5 text-[11px] font-bold text-amber">
        {row.daysFromDue <= 0 ? 'Due today' : `Due in ${row.daysFromDue}d`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-sand px-2.5 py-0.5 text-[11px] font-bold text-ink-mid">
      {row.status === 'upcoming' ? 'Upcoming' : row.status}
    </span>
  );
}

function AlertsCard({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <SectionCard
      title="Alerts"
      action={
        <button
          type="button"
          className="text-[12.5px] font-semibold text-ink-light hover:text-forest-700"
        >
          Dismiss all
        </button>
      }
    >
      {alerts.length === 0 ? (
        <p className="text-[13px] text-ink-light">All clear — nothing urgent right now.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 border-b border-border-soft pb-3 last:border-b-0 last:pb-0"
            >
              <span
                className={cn(
                  'mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                  a.badge.tone === 'alert' && 'bg-alert',
                  a.badge.tone === 'amber' && 'bg-amber',
                  a.badge.tone === 'blue' && 'bg-blue',
                  a.badge.tone === 'forest' && 'bg-forest-500',
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="font-sans text-[13px] font-semibold leading-tight text-ink">
                  {a.title}
                </div>
                <div className="mt-0.5 text-[12px] text-ink-light">{a.meta}</div>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                  a.badge.tone === 'alert' && 'bg-alert-bg text-alert',
                  a.badge.tone === 'amber' && 'bg-amber-bg text-amber',
                  a.badge.tone === 'blue' && 'bg-blue-bg text-blue',
                  a.badge.tone === 'forest' && 'bg-foam text-forest-700',
                )}
              >
                {a.badge.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function PortfolioStatsCard({ portfolio }: { portfolio: LandlordDashboard['portfolio'] }) {
  return (
    <SectionCard title="Portfolio stats">
      <MiniStatList>
        <MiniStat label="Total properties" value={portfolio.propertiesCount} />
        <MiniStat label="Total tenants" value={portfolio.tenantsCount} />
        <MiniStat
          label="Occupancy rate"
          value={<span className="text-forest-700">{portfolio.occupancyRate}%</span>}
        />
        <MiniStat
          label="Rent collected (this month)"
          value={formatMoneyWhole(portfolio.rentCollectedPence)}
        />
        <MiniStat
          label="Rent outstanding"
          value={
            <span className={portfolio.rentOutstandingPence > 0 ? 'text-alert' : ''}>
              {formatMoneyWhole(portfolio.rentOutstandingPence)}
            </span>
          }
        />
      </MiniStatList>
    </SectionCard>
  );
}

function PropertiesSnapshotCard({ slug, rows }: { slug: string; rows: DashboardPropertyRow[] }) {
  return (
    <SectionCard
      title="Properties"
      action={
        <Link
          href={`/landlord/${slug}/properties`}
          className="text-[12.5px] font-semibold text-forest-600 hover:underline"
        >
          View all →
        </Link>
      }
    >
      {rows.length === 0 ? (
        <EmptyEmbedded
          icon={<Building2 className="h-5 w-5" />}
          label="No properties yet"
          href={`/landlord/${slug}/properties/new`}
          ctaLabel="Add property"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((p) => {
            const occPct = p.rooms === 0 ? 0 : Math.round((p.occupiedRooms / p.rooms) * 100);
            return (
              <li
                key={p.id}
                className="flex items-center gap-3 border-b border-border-soft pb-3 last:border-b-0 last:pb-0"
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
                    p.thumb.bg,
                  )}
                  aria-hidden
                >
                  <Home className="h-4 w-4 text-ink" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-sans text-[13.5px] font-semibold text-ink">{p.name}</div>
                  <div className="text-[12px] text-ink-light">
                    {[p.city, p.postcode].filter(Boolean).join(' ')}
                    {p.rooms > 0 ? ` · ${p.rooms} rooms` : ''}
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-bg-page">
                    <div
                      className="h-full rounded-full bg-forest-500"
                      style={{ width: `${occPct}%` }}
                      aria-hidden
                    />
                  </div>
                </div>
                <div className="shrink-0 font-sans text-[13px] font-semibold text-ink">
                  {formatMoneyShort(p.monthlyRentPence)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

function MaintenanceSnapshotCard({
  slug,
  rows,
}: {
  slug: string;
  rows: DashboardMaintenanceRow[];
}) {
  return (
    <SectionCard
      title="Maintenance"
      action={
        <Link
          href={`/landlord/${slug}/maintenance`}
          className="text-[12.5px] font-semibold text-forest-600 hover:underline"
        >
          View all →
        </Link>
      }
    >
      {rows.length === 0 ? (
        <EmptyEmbedded icon={<Wrench className="h-5 w-5" />} label="No open tickets — nice work." />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-3 border-b border-border-soft pb-3 last:border-b-0 last:pb-0"
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                  m.severity === 'high'
                    ? 'bg-alert-bg'
                    : m.severity === 'medium'
                      ? 'bg-amber-bg'
                      : 'bg-blue-bg',
                )}
                aria-hidden
              >
                <AlertTriangle
                  className={cn(
                    'h-4 w-4',
                    m.severity === 'high'
                      ? 'text-alert'
                      : m.severity === 'medium'
                        ? 'text-amber'
                        : 'text-blue',
                  )}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-sans text-[13.5px] font-semibold text-ink">{m.title}</div>
                <div className="text-[12px] text-ink-light">
                  {m.property} · {m.ago}
                  {m.reporter ? ` · ${m.reporter}` : ''}
                </div>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                  m.severity === 'high'
                    ? 'bg-alert-bg text-alert'
                    : m.status === 'in_progress'
                      ? 'bg-blue-bg text-blue'
                      : 'bg-amber-bg text-amber',
                )}
              >
                {m.severity === 'high'
                  ? 'Urgent'
                  : m.status === 'in_progress'
                    ? 'In progress'
                    : 'Open'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function ComplianceSnapshotCard({ slug, rows }: { slug: string; rows: DashboardComplianceRow[] }) {
  return (
    <SectionCard
      title="Compliance snapshot"
      action={
        <Link
          href={`/landlord/${slug}/compliance`}
          className="text-[12.5px] font-semibold text-forest-600 hover:underline"
        >
          View all →
        </Link>
      }
    >
      {rows.length === 0 ? (
        <EmptyEmbedded
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Nothing tracked yet."
          href={`/landlord/${slug}/compliance`}
          ctaLabel="Add a certificate"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-3 border-b border-border-soft pb-3 last:border-b-0 last:pb-0"
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                  c.status === 'ok'
                    ? 'bg-foam'
                    : c.status === 'due_soon'
                      ? 'bg-amber-bg'
                      : 'bg-alert-bg',
                )}
                aria-hidden
              >
                <ShieldCheck
                  className={cn(
                    'h-4 w-4',
                    c.status === 'ok'
                      ? 'text-forest-700'
                      : c.status === 'due_soon'
                        ? 'text-amber'
                        : 'text-alert',
                  )}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-sans text-[13px] font-semibold text-ink">{c.title}</div>
                <div className="text-[12px] text-ink-light">{c.meta}</div>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                  c.status === 'ok'
                    ? 'bg-foam text-forest-700'
                    : c.status === 'due_soon'
                      ? 'bg-amber-bg text-amber'
                      : 'bg-alert-bg text-alert',
                )}
              >
                {c.status === 'ok'
                  ? 'Valid'
                  : c.status === 'due_soon'
                    ? c.daysRemaining != null
                      ? `${c.daysRemaining}d`
                      : 'Due soon'
                    : 'Overdue'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function EmptyEmbedded({
  icon,
  label,
  href,
  ctaLabel,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-bg-page text-ink-light">
        {icon}
      </span>
      <p className="text-[13px] text-ink-light">{label}</p>
      {href && ctaLabel ? (
        <Button asChild size="sm" variant="outline">
          <Link href={href}>
            {ctaLabel} <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
