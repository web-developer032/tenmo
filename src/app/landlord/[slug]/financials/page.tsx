import { BadgePoundSterling, Building2, Coins, FileSpreadsheet, PiggyBank } from 'lucide-react';
import { notFound } from 'next/navigation';
import { type Column, DataTable } from '@/components/ds/data-table';
import { KpiCard } from '@/components/ds/kpi-card';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { SectionCard } from '@/components/ds/section-card';
import { TabBar, type TabItem } from '@/components/ds/tab-bar';
import { Button } from '@/components/ui/button';
import { EXPENSE_CATEGORY_VALUES } from '@/core/schemas/expense';
import { AddExpenseModal } from '@/features/financials/components/add-expense-modal';
import { SubmitMtdForm } from '@/features/financials/components/submit-mtd-modal';
import {
  type ExpenseRow,
  type IncomeMonthRow,
  loadLandlordFinancials,
  type MtdQuarterCard,
} from '@/features/financials/load-landlord-financials';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };
type Search = { tab?: 'income' | 'expenses' | 'quarterly' | 'submit' };

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<string, string> = {
  repairs: 'Repairs',
  insurance: 'Insurance',
  mortgage: 'Mortgage',
  utilities: 'Utilities',
  agent_fees: 'Agent fees',
  compliance: 'Compliance',
  software: 'Software',
  travel: 'Travel',
  professional_fees: 'Professional fees',
  other: 'Other',
};

const CATEGORY_TONE: Record<string, string> = {
  repairs: 'bg-alert-bg text-alert',
  insurance: 'bg-amber-bg text-amber',
  mortgage: 'bg-blue-bg text-blue',
  utilities: 'bg-purple-bg text-purple',
  agent_fees: 'bg-foam text-forest-700',
  compliance: 'bg-amber-bg text-amber',
  software: 'bg-blue-bg text-blue',
  travel: 'bg-sand text-ink-mid',
  professional_fees: 'bg-purple-bg text-purple',
  other: 'bg-sand text-ink-mid',
};

const TAB_LABELS: Record<NonNullable<Search['tab']>, string> = {
  income: 'Income',
  expenses: 'Expenses',
  quarterly: 'Quarterly MTD',
  submit: 'Submit to HMRC',
};

export default async function LandlordFinancialsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<Search>;
}) {
  const { slug } = await params;
  const { tab = 'income' } = (await searchParams) ?? {};
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const supabase = await createClient();
  const data = await loadLandlordFinancials(supabase, org.id);
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('org_id', org.id)
    .order('name');

  const tabs: TabItem[] = (Object.keys(TAB_LABELS) as (keyof typeof TAB_LABELS)[]).map((id) => ({
    id,
    label: TAB_LABELS[id],
    href:
      id === 'income' ? `/landlord/${slug}/financials` : `/landlord/${slug}/financials?tab=${id}`,
  }));

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Financials & MTD' },
        ]}
        title="Financials & MTD"
        description={`Tax year ${data.taxYearLabel} · Making Tax Digital ready`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <a href={`/api/landlord/${slug}/financials/export`}>Export for accountant</a>
            </Button>
            <AddExpenseModal slug={slug} properties={properties ?? []} />
          </div>
        }
      />

      <ResponsiveGrid preset="kpi-5" aria-label="Financials summary">
        <KpiCard
          label="Gross income (YTD)"
          value={fmtMoney(data.kpis.grossIncomePence)}
          accent="forest"
          icon={<BadgePoundSterling />}
          delta={{ tone: 'up', value: 'YTD' }}
        />
        <KpiCard
          label="Total expenses (YTD)"
          value={fmtMoney(data.kpis.expensesPence)}
          accent="red"
          icon={<Coins />}
          delta={{ tone: 'down', value: 'YTD' }}
        />
        <KpiCard
          label="Net profit (YTD)"
          value={fmtMoney(data.kpis.netProfitPence)}
          accent="forest"
          icon={<PiggyBank />}
          delta={{ tone: 'up', value: 'Net' }}
        />
        <KpiCard
          label="Next MTD submission"
          value={fmtMoney(data.kpis.nextMtdAmountPence)}
          accent="amber"
          icon={<FileSpreadsheet />}
          delta={
            data.kpis.nextMtdQuarter ? { tone: 'warn', value: data.kpis.nextMtdQuarter } : undefined
          }
        />
        <KpiCard
          label="Monthly avg net"
          value={fmtMoney(data.kpis.monthlyNetYieldPence)}
          accent="blue"
          icon={<Building2 />}
          delta={{ tone: 'info', value: 'avg' }}
        />
      </ResponsiveGrid>

      <TabBar items={tabs} activeId={tab} />

      {tab === 'income' ? (
        <IncomeTab rows={data.income} taxYearLabel={data.taxYearLabel} slug={slug} />
      ) : null}
      {tab === 'expenses' ? (
        <ExpensesTab rows={data.expenses} taxYearLabel={data.taxYearLabel} slug={slug} />
      ) : null}
      {tab === 'quarterly' ? (
        <QuarterlyTab quarters={data.quarters} current={data.currentQuarter} slug={slug} />
      ) : null}
      {tab === 'submit' ? (
        <SectionCard className="max-w-2xl" title="Submit to HMRC via MTD">
          <SubmitMtdForm
            slug={slug}
            quarters={[
              {
                quarter: data.currentQuarter.quarter,
                label: `${humanQuarter(data.currentQuarter.quarter)} · ${humanRange(data.currentQuarter.periodStart, data.currentQuarter.periodEnd)}`,
                status: data.currentQuarter.status,
              },
              ...data.quarters.map((q) => ({
                quarter: q.quarter,
                label: `${humanQuarter(q.quarter)} · ${humanRange(q.periodStart, q.periodEnd)}`,
                status: q.status,
              })),
            ]}
          />
        </SectionCard>
      ) : null}
    </div>
  );
}

function IncomeTab({
  rows,
  taxYearLabel,
  slug,
}: {
  rows: IncomeMonthRow[];
  taxYearLabel: string;
  slug: string;
}) {
  const columns: Column<IncomeMonthRow>[] = [
    {
      id: 'month',
      header: 'Month',
      mobile: 'primary',
      cell: (r) => <strong className="text-ink">{r.label}</strong>,
    },
    {
      id: 'rooms',
      header: 'Rooms let',
      cell: (r) => `${r.roomsLet}/${r.totalRooms || r.roomsLet}`,
    },
    { id: 'expected', header: 'Expected', align: 'right', cell: (r) => fmtMoney(r.expectedPence) },
    {
      id: 'received',
      header: 'Received',
      align: 'right',
      mobile: 'secondary',
      cell: (r) => fmtMoney(r.receivedPence),
    },
    {
      id: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      cell: (r) => (
        <span
          className={cn(
            'font-semibold',
            r.outstandingPence === 0
              ? 'text-ink-light'
              : r.outstandingPence > 50000
                ? 'text-alert'
                : 'text-amber',
          )}
        >
          {fmtMoney(r.outstandingPence)}
        </span>
      ),
    },
    {
      id: 'pct',
      header: 'Collection',
      mobile: 'meta',
      align: 'right',
      cell: (r) => <CollectionPill pct={r.collectionPercent} />,
    },
  ];

  return (
    <SectionCard
      padded={false}
      title={`Rental income — ${taxYearLabel}`}
      action={
        <a
          href={`/api/landlord/${slug}/financials/export`}
          className="text-[12.5px] font-semibold text-forest-600 hover:underline"
        >
          Export CSV
        </a>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.monthIso}
        emptyState={<p className="text-[13px] text-ink-light">No income recorded yet.</p>}
        className="border-0 lg:rounded-none lg:border-0"
      />
    </SectionCard>
  );
}

function ExpensesTab({
  rows,
  taxYearLabel,
  slug: _slug,
}: {
  rows: ExpenseRow[];
  taxYearLabel: string;
  slug: string;
}) {
  const columns: Column<ExpenseRow>[] = [
    { id: 'date', header: 'Date', cell: (r) => fmtShort(r.occurredOn) },
    {
      id: 'desc',
      header: 'Description',
      mobile: 'primary',
      cell: (r) => <span className="font-semibold text-ink">{r.description}</span>,
    },
    {
      id: 'category',
      header: 'Category',
      mobile: 'meta',
      cell: (r) => (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold',
            CATEGORY_TONE[r.category] ?? CATEGORY_TONE.other,
          )}
        >
          {CATEGORY_LABELS[r.category] ?? r.category}
        </span>
      ),
    },
    {
      id: 'property',
      header: 'Property',
      mobile: 'secondary',
      cell: (r) => r.propertyName ?? 'All properties',
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (r) => <strong className="text-ink">{fmtMoney(r.amountPence)}</strong>,
    },
    {
      id: 'receipt',
      header: 'Receipt',
      cell: (r) =>
        r.hasReceipt ? (
          <span className="text-[12px] font-semibold text-blue">View PDF</span>
        ) : (
          <span className="text-[12px] text-ink-light">—</span>
        ),
    },
    {
      id: 'mtd',
      header: 'MTD eligible',
      align: 'right',
      cell: (r) =>
        r.mtdEligible ? (
          <span className="inline-flex items-center rounded-full bg-foam px-2.5 py-0.5 text-[11px] font-bold text-forest-700">
            Yes
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-sand px-2.5 py-0.5 text-[11px] font-bold text-ink-mid">
            No
          </span>
        ),
    },
  ];

  return (
    <SectionCard
      padded={false}
      title={`Expenses — ${taxYearLabel}`}
      action={
        <span className="text-[12px] text-ink-light">
          {rows.length} entr{rows.length === 1 ? 'y' : 'ies'} · {EXPENSE_CATEGORY_VALUES.length}{' '}
          categories
        </span>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        emptyState={
          <p className="text-[13px] text-ink-light">
            No expenses recorded — add one to start building your ledger.
          </p>
        }
        className="border-0 lg:rounded-none lg:border-0"
      />
    </SectionCard>
  );
}

function QuarterlyTab({
  quarters,
  current,
  slug,
}: {
  quarters: MtdQuarterCard[];
  current: MtdQuarterCard;
  slug: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quarters.map((q) => (
          <SectionCard
            key={q.quarter}
            title={`${humanQuarter(q.quarter)} · ${humanRange(q.periodStart, q.periodEnd)}`}
            action={
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                  q.status === 'submitted'
                    ? 'bg-foam text-forest-700'
                    : q.status === 'generated'
                      ? 'bg-blue-bg text-blue'
                      : 'bg-amber-bg text-amber',
                )}
              >
                {q.status === 'submitted'
                  ? 'Submitted'
                  : q.status === 'generated'
                    ? 'Generated'
                    : 'Draft'}
              </span>
            }
          >
            <MiniStat label="Income" value={fmtMoney(q.incomePence)} />
            <MiniStat label="Expenses" value={fmtMoney(q.expensePence)} />
            <MiniStat
              label="Net profit"
              value={<span className="text-forest-600">{fmtMoney(q.netProfitPence)}</span>}
            />
            <MiniStat label="Submitted" value={q.submittedAt ? fmtShort(q.submittedAt) : '—'} />
          </SectionCard>
        ))}
      </div>
      <SectionCard
        className="border-amber"
        title={
          <span className="text-amber">
            {humanQuarter(current.quarter)} · {humanRange(current.periodStart, current.periodEnd)} —
            Submission due
          </span>
        }
        action={
          <span className="inline-flex items-center rounded-full bg-amber-bg px-2.5 py-0.5 text-[11px] font-bold text-amber">
            {current.status === 'submitted'
              ? 'Submitted'
              : current.status === 'generated'
                ? 'Generated'
                : 'Draft'}
          </span>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <MiniStat label="Income" value={fmtMoney(current.incomePence)} />
            <MiniStat label="Expenses" value={fmtMoney(current.expensePence)} />
            <MiniStat
              label="Net profit"
              value={<span className="text-forest-600">{fmtMoney(current.netProfitPence)}</span>}
            />
          </div>
          <div className="flex items-center justify-end gap-2 md:col-span-2">
            <Button asChild variant="ghost">
              <a href={`/api/landlord/${slug}/financials/export`}>Download MTD report</a>
            </Button>
            <Button asChild>
              <a href={`/landlord/${slug}/financials?tab=submit`}>Submit to HMRC →</a>
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border-soft py-2 last:border-b-0">
      <span className="text-[12px] text-ink-light">{label}</span>
      <span className="font-sans text-[13.5px] font-bold text-ink">{value}</span>
    </div>
  );
}

function CollectionPill({ pct }: { pct: number }) {
  const tone =
    pct >= 100
      ? 'bg-foam text-forest-700'
      : pct >= 90
        ? 'bg-amber-bg text-amber'
        : 'bg-alert-bg text-alert';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold',
        tone,
      )}
    >
      {pct}%
    </span>
  );
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

function humanQuarter(q: string): string {
  return q.replace('Q', ' · Q');
}

function humanRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00Z`).toLocaleString('en-GB', { month: 'short' });
  const e = new Date(`${end}T00:00:00Z`).toLocaleString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
  return `${s}–${e}`;
}
