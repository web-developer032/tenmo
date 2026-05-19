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
  actorUserId?: string | null;
  /** Search by actor / target id substring or event name. */
  search?: string | null;
  /** Inclusive start of the time window. */
  since?: Date | string | null;
}

export interface ListAuditActorOption {
  user_id: string;
  full_name: string | null;
  contact_email: string | null;
}

export interface AdminAuditEntryEnriched extends AdminAuditEntry {
  actor_name: string | null;
  actor_email: string | null;
  actor_role: 'super' | 'support' | 'finance' | 'readonly' | null;
}

export interface ListAuditResult {
  rows: AdminAuditEntryEnriched[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  actor_options: ListAuditActorOption[];
}

export async function listAuditWithClient(
  sb: SupabaseClient,
  params: ListAuditParams = {},
): Promise<ListAuditResult> {
  const range = computePaginationRange(params.page, params.perPage);

  let query = sb
    .from('admin_audit_log')
    .select(
      `*,
       actor:actor_user_id(full_name, contact_email),
       actor_admin:actor_user_id(role)`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });

  if (params.event) query = query.eq('event', params.event);
  if (params.targetUserId) query = query.eq('target_user_id', params.targetUserId);
  if (params.targetOrgId) query = query.eq('target_org_id', params.targetOrgId);
  if (params.actorUserId) query = query.eq('actor_user_id', params.actorUserId);
  if (params.since) {
    const iso = typeof params.since === 'string' ? params.since : params.since.toISOString();
    query = query.gte('created_at', iso);
  }
  if (params.search && params.search.trim().length > 0) {
    const term = `%${params.search.trim()}%`;
    query = query.or(
      [
        `event::text.ilike.${term}`,
        `actor_user_id::text.ilike.${term}`,
        `target_user_id::text.ilike.${term}`,
        `target_org_id::text.ilike.${term}`,
      ].join(','),
    );
  }

  const { data, error, count } = await query.range(range.rangeStart, range.rangeEnd);
  if (error) throw new DbError(error);

  const rows: AdminAuditEntryEnriched[] = ((data ?? []) as Array<Record<string, unknown>>).map(
    (r) => {
      const actor = r.actor as { full_name: string | null; contact_email: string | null } | null;
      const actorAdmin = r.actor_admin as { role: string | null } | null;
      return {
        ...(r as unknown as AdminAuditEntry),
        actor_name: actor?.full_name ?? null,
        actor_email: actor?.contact_email ?? null,
        actor_role:
          (actorAdmin?.role as 'super' | 'support' | 'finance' | 'readonly' | null) ?? null,
      };
    },
  );

  // Pull a distinct list of admin actors for the filter drop-down.
  const { data: adminProfiles } = await sb
    .from('admin_users')
    .select('user_id, profiles:user_id(full_name, contact_email)')
    .eq('status', 'active');
  const actor_options: ListAuditActorOption[] = (
    (adminProfiles ?? []) as Array<Record<string, unknown>>
  ).map((r) => {
    const p = r.profiles as { full_name: string | null; contact_email: string | null } | null;
    return {
      user_id: r.user_id as string,
      full_name: p?.full_name ?? null,
      contact_email: p?.contact_email ?? null,
    };
  });

  return {
    rows,
    total: count ?? 0,
    page: range.page,
    per_page: range.perPage,
    total_pages: totalPages(count ?? 0, range.perPage),
    actor_options,
  };
}

export function listAudit(
  ctx: HandlerContext,
  params: ListAuditParams = {},
): Promise<ListAuditResult> {
  return listAuditWithClient(ctx.supabase, params);
}
