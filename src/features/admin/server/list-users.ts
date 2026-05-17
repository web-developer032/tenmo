import type { SupabaseClient } from '@supabase/supabase-js';
import { buildIlikePattern, computePaginationRange, totalPages } from '@/core/utils/admin-search';
import { DbError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Paginated list of platform users for the admin console.
 *
 * Reads `profiles` (everyone has one, created by the
 * `on_auth_user_created` trigger). RLS lets admins see all profile
 * rows, so we use the caller-scoped client.
 *
 * Admin status is fetched from `public.admin_users` in a second query
 * and stitched in JS rather than via a PostgREST embed, because
 * `admin_users.user_id` references `auth.users.id` (not `profiles.id`)
 * — there is no FK PostgREST can discover between `profiles` and
 * `admin_users`, so an embed would error at the database. The table
 * is tiny (platform staff only), so the extra round-trip is cheap.
 *
 * Two entry points share the same query so the route handler and
 * the RSC loader stay in lockstep:
 *   - `listUsers(ctx, params)`        — for API route handlers.
 *   - `listUsersWithClient(sb, params)` — for RSC loaders.
 */

export interface AdminUserRow {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  is_admin: boolean;
}

export interface ListUsersResult {
  rows: AdminUserRow[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ListUsersParams {
  q?: string | null;
  page?: number;
  perPage?: number;
}

export async function listUsersWithClient(
  sb: SupabaseClient,
  params: ListUsersParams = {},
): Promise<ListUsersResult> {
  const range = computePaginationRange(params.page, params.perPage);
  const pattern = buildIlikePattern(params.q);

  let query = sb
    .from('profiles')
    .select('id, full_name, preferred_name, contact_email, contact_phone, created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false });

  if (pattern) {
    // Postgres OR syntax for PostgREST:
    // "col1.ilike.%foo%,col2.ilike.%foo%".
    query = query.or(
      [
        `full_name.ilike.${pattern}`,
        `preferred_name.ilike.${pattern}`,
        `contact_email.ilike.${pattern}`,
        `contact_phone.ilike.${pattern}`,
      ].join(','),
    );
  }

  const [{ data, error, count }, adminLookup] = await Promise.all([
    query.range(range.rangeStart, range.rangeEnd),
    sb.from('admin_users').select('user_id'),
  ]);
  if (error) throw new DbError(error);
  if (adminLookup.error) throw new DbError(adminLookup.error);

  const adminIds = new Set((adminLookup.data ?? []).map((r) => r.user_id));

  type Row = {
    id: string;
    full_name: string | null;
    preferred_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    created_at: string;
  };

  const rows: AdminUserRow[] = ((data as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    preferred_name: r.preferred_name,
    contact_email: r.contact_email,
    contact_phone: r.contact_phone,
    created_at: r.created_at,
    is_admin: adminIds.has(r.id),
  }));

  return {
    rows,
    total: count ?? 0,
    page: range.page,
    per_page: range.perPage,
    total_pages: totalPages(count ?? 0, range.perPage),
  };
}

export function listUsers(
  ctx: HandlerContext,
  params: ListUsersParams = {},
): Promise<ListUsersResult> {
  return listUsersWithClient(ctx.supabase, params);
}
