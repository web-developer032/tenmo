import { ArrowLeft, CalendarClock, CreditCard, Download, Shield, Wallet } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Banner, DataTable, KpiCard, PageHeader, SectionCard } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/core/utils/money';
import { TenancyDocumentsCard } from '@/features/documents/components/tenancy-documents-card';
import { resolveTenancyConversationId } from '@/features/messaging/server';
import { MandateStatusCard } from '@/features/payments/components/mandate-status-card';
import { loadActiveMandateForTenancy } from '@/features/payments/loaders';
import { loadTenantPaymentsView, type TenantPaymentRow } from '@/features/rent/loaders';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/server';

type Params = { tenancyId: string };
type SearchParams = { year?: string };

export const dynamic = 'force-dynamic';

/**
 * `/tenant/rent/[tenancyId]` — tenant Payments page (HMOeez redesign).
 *
 * KPI strip + next-payment banner + a single flat `DataTable` of all
 * charges/payments. The optional `?year=` query filters the table; the
 * KPIs always reflect the current calendar year so they don't jump as
 * the user changes the filter.
 *
 * RLS already restricts rent_charges/rent_payments to the caller's own
 * tenancies; we additionally double-check that the tenancy belongs to
 * this user (defence in depth).
 */
export default async function TenantPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  const { tenancyId } = await params;
  const sp = (await searchParams) ?? {};
  const year: number | 'all' =
    sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : sp.year === 'all' ? 'all' : 'all';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/tenant/rent/${tenancyId}`);

  const tenancyResp = await supabase
    .from('tenancies')
    .select(
      `id, tenant_user_id, rent_pence, rent_frequency,
       properties:property_id ( name ),
       rooms:room_id ( name )`,
    )
    .eq('id', tenancyId)
    .maybeSingle();
  if (tenancyResp.error) throw tenancyResp.error;
  const tenancy = tenancyResp.data;
  if (!tenancy || tenancy.tenant_user_id !== user.id) notFound();

  const property = pickFirst<{ name: string }>(tenancy.properties);
  const room = pickFirst<{ name: string }>(tenancy.rooms);

  const [view, conversationId, mandate] = await Promise.all([
    loadTenantPaymentsView(tenancyId, year),
    resolveTenancyConversationId(tenancyId),
    loadActiveMandateForTenancy(tenancyId),
  ]);

  const yearLabel = year === 'all' ? 'all time' : String(year);

  const yearOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'All time' },
    ...view.availableYears.map((y) => ({ value: String(y), label: String(y) })),
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenant', href: '/tenant' },
          { label: 'Payments', href: '/tenant/rent' },
        ]}
        title="Payments"
        description={
          <>
            {property?.name ?? 'Your home'}
            {room?.name ? ` — ${room.name}` : ''} · {yearLabel}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <YearFilter
              activeValue={year === 'all' ? 'all' : String(year)}
              options={yearOptions}
              tenancyId={tenancyId}
            />
            {conversationId ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/messages/${conversationId}`}>Message landlord</Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link href="/tenant">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
          </div>
        }
      />

      {/* ── KPI strip ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={`Paid this year (${new Date().getUTCFullYear()})`}
          value={formatMoney(view.kpis.paidThisYearPence).replace(/\.00$/, '')}
          icon={<CreditCard />}
          accent="forest"
          delta={{ value: 'On time', tone: 'up' }}
        />
        <KpiCard
          label="Monthly rent"
          value={formatMoney(view.kpis.monthlyRentPence).replace(/\.00$/, '')}
          icon={<Wallet />}
          accent="forest"
        />
        <KpiCard
          label={
            view.kpis.depositSchemeLabel
              ? `Deposit (${view.kpis.depositSchemeLabel} protected)`
              : 'Deposit'
          }
          value={formatMoney(view.kpis.depositPence).replace(/\.00$/, '')}
          icon={<Shield />}
          accent="forest"
          delta={
            view.kpis.depositSchemeLabel
              ? { value: view.kpis.depositSchemeLabel, tone: 'up' }
              : undefined
          }
        />
        <KpiCard
          label="Next payment due"
          value={view.kpis.nextPaymentDueDate ? shortDate(view.kpis.nextPaymentDueDate) : '—'}
          icon={<CalendarClock />}
          accent={view.kpis.nextPaymentDueDate ? 'amber' : 'forest'}
          delta={view.kpis.nextPaymentDueDate ? { value: 'Next', tone: 'warn' } : undefined}
        />
      </div>

      {/* ── Next payment banner ─────────────────────────────────────── */}
      {view.next ? (
        <Banner
          tone="info"
          title={`Next payment — ${formatMoney(view.next.amountPence).replace(/\.00$/, '')} due ${longDate(view.next.dueDate)}`}
          description={
            <>
              Please transfer to the bank details in your tenancy agreement. Use reference{' '}
              <strong className="font-semibold text-ink">{view.reference}</strong>.
            </>
          }
        />
      ) : null}

      {/* ── Payments table ──────────────────────────────────────────── */}
      <SectionCard
        title="Payment history"
        action={
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Download all receipts
          </Button>
        }
        padded={false}
      >
        <DataTable<TenantPaymentRow>
          rowKey={(r) => r.id}
          rows={view.rows}
          emptyState={
            <p className="text-[13px] text-ink-light">No payments in the selected period.</p>
          }
          columns={[
            {
              id: 'month',
              header: 'Month',
              mobile: 'primary',
              cell: (row) => <strong className="font-semibold text-ink">{row.monthLabel}</strong>,
            },
            {
              id: 'amount',
              header: 'Amount',
              align: 'right',
              cell: (row) => (
                <span className="font-bold text-ink">
                  {formatMoney(row.amountPence).replace(/\.00$/, '')}
                </span>
              ),
            },
            {
              id: 'due',
              header: 'Due date',
              cell: (row) => shortDate(row.dueDate),
              hideMd: true,
            },
            {
              id: 'paid',
              header: 'Paid date',
              mobile: 'secondary',
              cell: (row) => (row.paidAt ? shortDate(row.paidAt) : '—'),
            },
            {
              id: 'method',
              header: 'Method',
              cell: (row) => row.methodLabel,
              hideMd: true,
            },
            {
              id: 'ref',
              header: 'Reference',
              cell: (row) => <span className="text-[12px] text-ink-light">{row.reference}</span>,
              hideMd: true,
            },
            {
              id: 'status',
              header: 'Status',
              mobile: 'meta',
              cell: (row) => <StatusBadge row={row} />,
            },
            {
              id: 'receipt',
              header: 'Receipt',
              align: 'right',
              cell: (row) =>
                row.status === 'paid' || row.status === 'paid_late' ? (
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-forest-700 hover:underline"
                  >
                    Download
                  </button>
                ) : (
                  <span className="text-[12px] text-ink-light">—</span>
                ),
            },
          ]}
        />
      </SectionCard>

      {/* ── Direct Debit (optional) ─────────────────────────────────── */}
      <SectionCard
        title="Direct Debit"
        subtitle="Set up free Direct Debit through GoCardless so rent is collected automatically each month."
      >
        <MandateStatusCard tenancyId={tenancyId} mandate={mandate} />
        <p className="mt-3 text-[12px] text-ink-light">
          Tenantly is <span className="font-semibold text-ink">free for tenants, forever</span>.
        </p>
      </SectionCard>

      <TenancyDocumentsCard tenancyId={tenancyId} actorRole="tenant" />
    </div>
  );
}

function YearFilter({
  activeValue,
  options,
  tenancyId,
}: {
  activeValue: string;
  options: { value: string; label: string }[];
  tenancyId: string;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-card border border-border-soft bg-white p-1">
      {options.map((opt) => {
        const isActive = opt.value === activeValue;
        const href =
          opt.value === 'all'
            ? `/tenant/rent/${tenancyId}`
            : `/tenant/rent/${tenancyId}?year=${opt.value}`;
        return (
          <Link
            key={opt.value}
            href={href}
            className={cn(
              'rounded-button px-3 py-1 text-[12px] font-semibold transition-colors',
              isActive
                ? 'bg-forest-600 text-white'
                : 'text-ink-light hover:bg-foam hover:text-forest-700',
            )}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}

const STATUS_BADGE: Record<
  TenantPaymentRow['status'],
  { label: (r: TenantPaymentRow) => string; classes: string }
> = {
  paid: { label: () => 'Paid', classes: 'bg-forest-100 text-forest-700' },
  paid_late: { label: (r) => `${r.daysLate}d late`, classes: 'bg-amber-bg text-amber' },
  due: { label: () => 'Due', classes: 'bg-amber-bg text-amber' },
  overdue: { label: () => 'Overdue', classes: 'bg-alert-bg text-alert' },
  upcoming: { label: () => 'Upcoming', classes: 'bg-foam text-forest-700' },
  cancelled: { label: () => 'Cancelled', classes: 'bg-foam text-ink-light' },
  partial: { label: () => 'Partial', classes: 'bg-amber-bg text-amber' },
};

function StatusBadge({ row }: { row: TenantPaymentRow }) {
  const status = STATUS_BADGE[row.status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider',
        status.classes,
      )}
    >
      {status.label(row)}
    </span>
  );
}

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
