import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side loader for the `/landlord/[slug]/financials` page.
 *
 * Aggregates the org's expenses + rent ledger into the five headline
 * KPIs, a monthly income breakdown, an expense ledger, and a list of
 * quarterly MTD submissions for the current UK tax year (April–March).
 *
 * All amounts are in pence to match the rest of the platform; the UI
 * formats them on render.
 */

export type FinancialsKpis = {
  grossIncomePence: number;
  expensesPence: number;
  netProfitPence: number;
  nextMtdAmountPence: number;
  nextMtdQuarter: string | null;
  monthlyNetYieldPence: number;
};

export type IncomeMonthRow = {
  monthIso: string;
  label: string;
  roomsLet: number;
  totalRooms: number;
  expectedPence: number;
  receivedPence: number;
  outstandingPence: number;
  collectionPercent: number;
};

export type ExpenseRow = {
  id: string;
  occurredOn: string;
  description: string;
  category: string;
  propertyName: string | null;
  amountPence: number;
  hasReceipt: boolean;
  mtdEligible: boolean;
  mtdQuarter: string | null;
};

export type MtdQuarterCard = {
  id: string | null;
  quarter: string;
  periodStart: string;
  periodEnd: string;
  incomePence: number;
  expensePence: number;
  netProfitPence: number;
  status: 'draft' | 'generated' | 'submitted';
  submittedAt: string | null;
};

export type LandlordFinancialsData = {
  taxYearLabel: string;
  kpis: FinancialsKpis;
  income: IncomeMonthRow[];
  expenses: ExpenseRow[];
  quarters: MtdQuarterCard[];
  currentQuarter: MtdQuarterCard;
};

type ExpenseQueryRow = {
  id: string;
  occurred_on: string;
  description: string;
  category: string;
  amount_pence: number;
  mtd_eligible: boolean;
  mtd_quarter: string | null;
  receipt_document_id: string | null;
  property_id: string | null;
  properties: { name: string } | { name: string }[] | null;
};

type ChargeRow = {
  id: string;
  amount_pence: number;
  due_date: string;
  status: string;
};

type PaymentRow = {
  amount_pence: number;
  paid_at: string;
};

function firstOf<T>(value: unknown): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return value as T;
}

function ukTaxYear(now: Date): { startIso: string; endIso: string; label: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0 = Jan
  const startYear = month >= 3 ? year : year - 1; // April = month 3
  const start = new Date(Date.UTC(startYear, 3, 6));
  const end = new Date(Date.UTC(startYear + 1, 3, 5));
  return {
    startIso: start.toISOString().slice(0, 10),
    endIso: end.toISOString().slice(0, 10),
    label: `${startYear}–${String(startYear + 1).slice(-2)}`,
  };
}

function quarterFromDate(d: Date): { quarter: string; start: string; end: string } {
  const month = d.getUTCMonth(); // 0..11
  const year = d.getUTCFullYear();
  let qStartMonth: number;
  let qStartYear: number;
  if (month <= 2) {
    qStartMonth = 0;
    qStartYear = year;
  } else if (month <= 5) {
    qStartMonth = 3;
    qStartYear = year;
  } else if (month <= 8) {
    qStartMonth = 6;
    qStartYear = year;
  } else {
    qStartMonth = 9;
    qStartYear = year;
  }
  const qNumber = qStartMonth / 3 + 1;
  const startD = new Date(Date.UTC(qStartYear, qStartMonth, 1));
  const endD = new Date(Date.UTC(qStartYear, qStartMonth + 3, 0));
  return {
    quarter: `${qStartYear}Q${qNumber}`,
    start: startD.toISOString().slice(0, 10),
    end: endD.toISOString().slice(0, 10),
  };
}

function monthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
}

export async function loadLandlordFinancials(
  supabase: SupabaseClient,
  orgId: string,
  now: Date = new Date(),
): Promise<LandlordFinancialsData> {
  const taxYear = ukTaxYear(now);

  const [chargesResp, paymentsResp, expensesResp, roomsResp, mtdResp] = await Promise.all([
    supabase
      .from('rent_charges')
      .select('id, amount_pence, due_date, status')
      .eq('org_id', orgId)
      .gte('due_date', taxYear.startIso)
      .lte('due_date', taxYear.endIso),
    supabase
      .from('rent_payments')
      .select('amount_pence, paid_at')
      .eq('org_id', orgId)
      .not('paid_at', 'is', null)
      .gte('paid_at', `${taxYear.startIso}T00:00:00Z`)
      .lte('paid_at', `${taxYear.endIso}T23:59:59Z`),
    supabase
      .from('expenses')
      .select(
        `id, occurred_on, description, category, amount_pence, mtd_eligible, mtd_quarter,
         receipt_document_id, property_id, properties:property_id (name)`,
      )
      .eq('org_id', orgId)
      .gte('occurred_on', taxYear.startIso)
      .lte('occurred_on', taxYear.endIso)
      .order('occurred_on', { ascending: false }),
    supabase
      .from('rooms')
      .select('id, property_id, properties!inner(org_id)')
      .eq('properties.org_id', orgId),
    supabase
      .from('mtd_submissions')
      .select(
        'id, quarter, period_start, period_end, income_pence, expense_pence, net_profit_pence, status, submitted_at',
      )
      .eq('org_id', orgId)
      .order('period_end', { ascending: true }),
  ]);

  if (chargesResp.error) throw chargesResp.error;
  if (paymentsResp.error) throw paymentsResp.error;
  if (expensesResp.error) throw expensesResp.error;
  if (mtdResp.error) throw mtdResp.error;

  const charges = (chargesResp.data ?? []) as ChargeRow[];
  const payments = (paymentsResp.data ?? []) as PaymentRow[];
  const expensesRaw = (expensesResp.data ?? []) as ExpenseQueryRow[];
  const totalRooms = roomsResp.data?.length ?? 0;

  // KPIs ----------------------------------------------------------------
  const grossIncomePence = payments.reduce((sum, p) => sum + p.amount_pence, 0);
  const expensesPence = expensesRaw.reduce((sum, e) => sum + e.amount_pence, 0);
  const netProfitPence = grossIncomePence - expensesPence;

  // Income breakdown by month ------------------------------------------
  const monthMap = new Map<string, { expected: number; received: number; rooms: Set<string> }>();
  const seedMonthBuckets = () => {
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(Date.UTC(Number(taxYear.startIso.slice(0, 4)), 3 + i, 1));
      if (d > now) break;
      monthMap.set(d.toISOString().slice(0, 7), { expected: 0, received: 0, rooms: new Set() });
    }
  };
  seedMonthBuckets();

  for (const c of charges) {
    const key = c.due_date.slice(0, 7);
    const bucket = monthMap.get(key);
    if (bucket) {
      bucket.expected += c.amount_pence;
      bucket.rooms.add(c.id);
    }
  }
  for (const p of payments) {
    const key = p.paid_at.slice(0, 7);
    const bucket = monthMap.get(key);
    if (bucket) bucket.received += p.amount_pence;
  }

  const income: IncomeMonthRow[] = Array.from(monthMap.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, bucket]) => {
      const roomsLet = bucket.rooms.size;
      const outstanding = Math.max(0, bucket.expected - bucket.received);
      const collection =
        bucket.expected > 0 ? Math.round((bucket.received / bucket.expected) * 100) : 0;
      return {
        monthIso: `${key}-01`,
        label: monthLabel(`${key}-01`),
        roomsLet,
        totalRooms,
        expectedPence: bucket.expected,
        receivedPence: bucket.received,
        outstandingPence: outstanding,
        collectionPercent: collection,
      };
    });

  // Expense ledger -----------------------------------------------------
  const expenses: ExpenseRow[] = expensesRaw.map((e) => ({
    id: e.id,
    occurredOn: e.occurred_on,
    description: e.description,
    category: e.category,
    propertyName: firstOf<{ name: string }>(e.properties)?.name ?? null,
    amountPence: e.amount_pence,
    hasReceipt: Boolean(e.receipt_document_id),
    mtdEligible: e.mtd_eligible,
    mtdQuarter: e.mtd_quarter,
  }));

  // MTD quarters -------------------------------------------------------
  const submitted: MtdQuarterCard[] = (mtdResp.data ?? []).map((row) => ({
    id: row.id,
    quarter: row.quarter,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    incomePence: row.income_pence,
    expensePence: row.expense_pence,
    netProfitPence: row.net_profit_pence,
    status: row.status as MtdQuarterCard['status'],
    submittedAt: row.submitted_at,
  }));

  // Derive a "current quarter" card from live income / expenses.
  const currentQ = quarterFromDate(now);
  const liveIncome = payments
    .filter((p) => {
      const date = p.paid_at.slice(0, 10);
      return date >= currentQ.start && date <= currentQ.end;
    })
    .reduce((sum, p) => sum + p.amount_pence, 0);
  const liveExpense = expensesRaw
    .filter((e) => e.occurred_on >= currentQ.start && e.occurred_on <= currentQ.end)
    .reduce((sum, e) => sum + e.amount_pence, 0);
  const existingCurrent = submitted.find((q) => q.quarter === currentQ.quarter);
  const currentQuarter: MtdQuarterCard = existingCurrent ?? {
    id: null,
    quarter: currentQ.quarter,
    periodStart: currentQ.start,
    periodEnd: currentQ.end,
    incomePence: liveIncome,
    expensePence: liveExpense,
    netProfitPence: liveIncome - liveExpense,
    status: 'draft',
    submittedAt: null,
  };

  // Monthly net yield = average net profit per month seen so far.
  const monthsObserved = Math.max(income.length, 1);
  const monthlyNetYieldPence = Math.round(netProfitPence / monthsObserved);

  return {
    taxYearLabel: taxYear.label,
    kpis: {
      grossIncomePence,
      expensesPence,
      netProfitPence,
      nextMtdAmountPence: currentQuarter.netProfitPence,
      nextMtdQuarter: currentQuarter.quarter,
      monthlyNetYieldPence,
    },
    income,
    expenses,
    quarters: submitted.filter((q) => q.quarter !== currentQuarter.quarter),
    currentQuarter,
  };
}
