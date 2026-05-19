import type { SupabaseClient } from '@supabase/supabase-js';
import { computePaginationRange, totalPages } from '@/core/utils/admin-search';
import { DbError } from '@/lib/errors';

/**
 * Loader for `/admin/compliance`.
 *
 * Backed by the `admin_compliance_violations` view, which unions
 * expired/expiring certs, unprotected deposits and overdue R2R
 * re-checks. The view already pre-joins `orgs` so we get
 * `landlord_name` / `org_slug` directly.
 */

export type AdminViolationRow = {
  id: string;
  kind: string;
  severity: 'critical' | 'warning' | 'info' | string;
  org_id: string;
  landlord_name: string | null;
  org_slug: string | null;
  subject: string | null;
  details: string | null;
  days_outstanding: number;
  reference_date: string | null;
  created_at: string;
};

export type ListViolationsParams = {
  q?: string | null;
  severity?: 'all' | 'critical' | 'warning' | 'info' | null;
  kind?: 'all' | string | null;
  page?: number;
  perPage?: number;
};

export type ListViolationsResult = {
  rows: AdminViolationRow[];
  total: number;
  critical_total: number;
  warning_total: number;
  by_kind: Record<string, number>;
  page: number;
  per_page: number;
  total_pages: number;
};

export async function listComplianceViolationsWithClient(
  sb: SupabaseClient,
  params: ListViolationsParams = {},
): Promise<ListViolationsResult> {
  const range = computePaginationRange(params.page, params.perPage);

  let query = sb.from('admin_compliance_violations').select('*', { count: 'exact' });

  if (params.q && params.q.trim().length > 0) {
    const term = `%${params.q.trim()}%`;
    query = query.or(
      [`landlord_name.ilike.${term}`, `subject.ilike.${term}`, `details.ilike.${term}`].join(','),
    );
  }
  if (params.severity && params.severity !== 'all') {
    query = query.eq('severity', params.severity);
  }
  if (params.kind && params.kind !== 'all') {
    query = query.eq('kind', params.kind);
  }

  // Sort by severity (critical first) then days_outstanding desc.
  query = query.order('severity', { ascending: true }).order('days_outstanding', {
    ascending: false,
  });

  const { data, error, count } = await query.range(range.rangeStart, range.rangeEnd);
  if (error) throw new DbError(error);

  const rows: AdminViolationRow[] = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    kind: r.kind as string,
    severity: r.severity as string,
    org_id: r.org_id as string,
    landlord_name: (r.landlord_name as string | null) ?? null,
    org_slug: (r.org_slug as string | null) ?? null,
    subject: (r.subject as string | null) ?? null,
    details: (r.details as string | null) ?? null,
    days_outstanding: Number(r.days_outstanding ?? 0),
    reference_date: (r.reference_date as string | null) ?? null,
    created_at: r.created_at as string,
  }));

  // Aggregate KPI counts in a single follow-up query.
  const { data: aggData, error: aggErr } = await sb
    .from('admin_compliance_violations')
    .select('kind, severity');
  if (aggErr) throw new DbError(aggErr);

  let critical_total = 0;
  let warning_total = 0;
  const by_kind: Record<string, number> = {};
  for (const r of (aggData ?? []) as Array<{ kind: string; severity: string }>) {
    if (r.severity === 'critical') critical_total += 1;
    if (r.severity === 'warning') warning_total += 1;
    by_kind[r.kind] = (by_kind[r.kind] ?? 0) + 1;
  }

  return {
    rows,
    total: count ?? 0,
    critical_total,
    warning_total,
    by_kind,
    page: range.page,
    per_page: range.perPage,
    total_pages: totalPages(count ?? 0, range.perPage),
  };
}
