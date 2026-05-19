import type { SupabaseClient } from '@supabase/supabase-js';
import { computePaginationRange, totalPages } from '@/core/utils/admin-search';
import { DbError } from '@/lib/errors';

/**
 * Loader for `/admin/support` (platform support tickets).
 *
 * Reads `platform_support_tickets` joined with the reporter profile
 * and assignee profile. Filterable by status, priority, "unassigned"
 * pseudo-status, assignee and free-text search.
 */

export type AdminTicketRow = {
  id: string;
  ref_number: number;
  title: string;
  description: string | null;
  category: 'bug' | 'integration' | 'email' | 'reports' | 'billing' | 'other';
  priority: 'low' | 'med' | 'high';
  status: 'open' | 'in_progress' | 'resolved';
  reporter_user_id: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  org_id: string | null;
  org_name: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ListSupportParams = {
  q?: string | null;
  status?: 'all' | 'open' | 'in_progress' | 'resolved' | null;
  priority?: 'all' | 'low' | 'med' | 'high' | null;
  filter?: 'all' | 'high' | 'unassigned' | 'resolved' | null;
  assignee?: 'all' | 'me' | string | null;
  callerId?: string | null;
  page?: number;
  perPage?: number;
};

export type ListSupportResult = {
  rows: AdminTicketRow[];
  total: number;
  open_total: number;
  unassigned_total: number;
  high_total: number;
  resolved_week_total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

export async function listSupportTicketsWithClient(
  sb: SupabaseClient,
  params: ListSupportParams = {},
): Promise<ListSupportResult> {
  const range = computePaginationRange(params.page, params.perPage);

  let query = sb.from('platform_support_tickets').select(
    `id, ref_number, title, description, category, priority, status,
       reporter_user_id, org_id, assigned_to, resolved_at, created_at, updated_at,
       reporter:reporter_user_id(full_name, contact_email),
       assignee:assigned_to(full_name),
       org:org_id(name)`,
    { count: 'exact' },
  );

  if (params.q && params.q.trim().length > 0) {
    const term = `%${params.q.trim()}%`;
    query = query.or([`title.ilike.${term}`, `description.ilike.${term}`].join(','));
  }

  // Tab filter takes precedence over status/priority drop-downs.
  const tab = params.filter ?? 'all';
  switch (tab) {
    case 'high':
      query = query.eq('priority', 'high').neq('status', 'resolved');
      break;
    case 'unassigned':
      query = query.is('assigned_to', null).neq('status', 'resolved');
      break;
    case 'resolved':
      query = query.eq('status', 'resolved');
      break;
    default:
      if (params.status && params.status !== 'all') {
        query = query.eq('status', params.status);
      } else {
        query = query.neq('status', 'resolved');
      }
  }

  if (params.priority && params.priority !== 'all') {
    query = query.eq('priority', params.priority);
  }
  if (params.assignee === 'me' && params.callerId) {
    query = query.eq('assigned_to', params.callerId);
  } else if (params.assignee && !['all', 'me'].includes(params.assignee)) {
    query = query.eq('assigned_to', params.assignee);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query.range(range.rangeStart, range.rangeEnd);
  if (error) throw new DbError(error);

  const rows: AdminTicketRow[] = ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const reporter = r.reporter as {
      full_name: string | null;
      contact_email: string | null;
    } | null;
    const assignee = r.assignee as { full_name: string | null } | null;
    const org = r.org as { name: string | null } | null;
    return {
      id: r.id as string,
      ref_number: Number(r.ref_number ?? 0),
      title: r.title as string,
      description: (r.description as string | null) ?? null,
      category: r.category as AdminTicketRow['category'],
      priority: r.priority as AdminTicketRow['priority'],
      status: r.status as AdminTicketRow['status'],
      reporter_user_id: (r.reporter_user_id as string | null) ?? null,
      reporter_name: reporter?.full_name ?? null,
      reporter_email: reporter?.contact_email ?? null,
      org_id: (r.org_id as string | null) ?? null,
      org_name: org?.name ?? null,
      assigned_to: (r.assigned_to as string | null) ?? null,
      assignee_name: assignee?.full_name ?? null,
      resolved_at: (r.resolved_at as string | null) ?? null,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
    };
  });

  // KPI counts (single roundtrip each, head-only).
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [openCount, unassignedCount, highCount, resolvedWeek] = await Promise.all([
    sb
      .from('platform_support_tickets')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']),
    sb
      .from('platform_support_tickets')
      .select('id', { count: 'exact', head: true })
      .is('assigned_to', null)
      .in('status', ['open', 'in_progress']),
    sb
      .from('platform_support_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('priority', 'high')
      .in('status', ['open', 'in_progress']),
    sb
      .from('platform_support_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'resolved')
      .gte('resolved_at', weekAgo),
  ]);

  return {
    rows,
    total: count ?? 0,
    open_total: openCount.count ?? 0,
    unassigned_total: unassignedCount.count ?? 0,
    high_total: highCount.count ?? 0,
    resolved_week_total: resolvedWeek.count ?? 0,
    page: range.page,
    per_page: range.perPage,
    total_pages: totalPages(count ?? 0, range.perPage),
  };
}
