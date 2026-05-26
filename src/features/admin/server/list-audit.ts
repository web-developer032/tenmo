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

  // We used to embed actor profile + admin role inline via PostgREST. That
  // path relies on FK relationships PostgREST can't resolve here (audit-log
  // FK target is auth.users, not profiles/admin_users), so we fetch them in
  // a second + third batch below.
  let query = sb
    .from('admin_audit_log')
    .select(`*`, { count: 'exact' })
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

  const rawRows = (data ?? []) as Array<Record<string, unknown>>;
  const actorIds = Array.from(
    new Set(rawRows.map((r) => r.actor_user_id as string | null).filter(Boolean)),
  ) as string[];

  // Hydrate actor profile + admin role in batches.
  const profileById = new Map<string, { full_name: string | null; contact_email: string | null }>();
  const roleByUserId = new Map<string, 'super' | 'support' | 'finance' | 'readonly' | null>();
  if (actorIds.length > 0) {
    const [profilesRes, adminRes] = await Promise.all([
      sb.from('profiles').select('id, full_name, contact_email').in('id', actorIds),
      sb.from('admin_users').select('user_id, role').in('user_id', actorIds),
    ]);
    for (const p of (profilesRes.data ?? []) as Array<{
      id: string;
      full_name: string | null;
      contact_email: string | null;
    }>) {
      profileById.set(p.id, { full_name: p.full_name, contact_email: p.contact_email });
    }
    for (const a of (adminRes.data ?? []) as Array<{
      user_id: string;
      role: 'super' | 'support' | 'finance' | 'readonly' | null;
    }>) {
      roleByUserId.set(a.user_id, a.role ?? null);
    }
  }

  const rows: AdminAuditEntryEnriched[] = rawRows.map((r) => {
    const actorId = r.actor_user_id as string | null;
    const profile = actorId ? (profileById.get(actorId) ?? null) : null;
    const role = actorId ? (roleByUserId.get(actorId) ?? null) : null;
    return {
      ...(r as unknown as AdminAuditEntry),
      actor_name: profile?.full_name ?? null,
      actor_email: profile?.contact_email ?? null,
      actor_role: role,
    };
  });

  // Distinct admin actors for the filter drop-down — admin_users.user_id
  // FKs auth.users.id, not profiles.id, so we batch the lookup.
  const { data: adminRows } = await sb.from('admin_users').select('user_id').eq('status', 'active');
  const adminIds = Array.from(
    new Set(((adminRows ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)),
  );
  const adminProfileById = new Map<
    string,
    { full_name: string | null; contact_email: string | null }
  >();
  if (adminIds.length > 0) {
    const { data: adminProfiles } = await sb
      .from('profiles')
      .select('id, full_name, contact_email')
      .in('id', adminIds);
    for (const p of (adminProfiles ?? []) as Array<{
      id: string;
      full_name: string | null;
      contact_email: string | null;
    }>) {
      adminProfileById.set(p.id, { full_name: p.full_name, contact_email: p.contact_email });
    }
  }
  const actor_options: ListAuditActorOption[] = adminIds.map((user_id) => {
    const p = adminProfileById.get(user_id);
    return {
      user_id,
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
