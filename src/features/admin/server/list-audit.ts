import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminEventKind } from '@/core/constants/admin';
import type { AdminAuditEntry } from '@/core/schemas/admin';
import { computePaginationRange, totalPages } from '@/core/utils/admin-search';
import { DbError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Paginated read of `public.admin_audit_log` for `/admin/audit`.
 * Filters: `event` (single kind) and `target_org_id` / `target_user_id`.
 */

export interface ListAuditParams {
  page?: number;
  perPage?: number;
  event?: AdminEventKind | null;
  targetUserId?: string | null;
  targetOrgId?: string | null;
}

export interface ListAuditResult {
  rows: AdminAuditEntry[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export async function listAuditWithClient(
  sb: SupabaseClient,
  params: ListAuditParams = {},
): Promise<ListAuditResult> {
  const range = computePaginationRange(params.page, params.perPage);

  let query = sb
    .from('admin_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (params.event) query = query.eq('event', params.event);
  if (params.targetUserId) query = query.eq('target_user_id', params.targetUserId);
  if (params.targetOrgId) query = query.eq('target_org_id', params.targetOrgId);

  const { data, error, count } = await query.range(range.rangeStart, range.rangeEnd);
  if (error) throw new DbError(error);

  return {
    rows: (data ?? []) as AdminAuditEntry[],
    total: count ?? 0,
    page: range.page,
    per_page: range.perPage,
    total_pages: totalPages(count ?? 0, range.perPage),
  };
}

export function listAudit(
  ctx: HandlerContext,
  params: ListAuditParams = {},
): Promise<ListAuditResult> {
  return listAuditWithClient(ctx.supabase, params);
}
