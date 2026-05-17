import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminAuditEntry } from '@/core/schemas/admin';
import { DbError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Top-line KPIs for the `/admin` landing page plus the most recent
 * admin audit entries. Cheap to render — every count uses
 * `head: true` so we never load the rows themselves.
 */

export interface AdminDashboardStats {
  counts: {
    users: number;
    orgs: number;
    active_tenancies: number;
    paid_subscriptions: number;
    overrides_active: number;
  };
  recent_activity: AdminAuditEntry[];
}

export async function getDashboardStatsWithClient(
  sb: SupabaseClient,
): Promise<AdminDashboardStats> {
  const [users, orgs, tenancies, paid, overrides, activity] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('orgs').select('id', { count: 'exact', head: true }),
    sb.from('tenancies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    sb
      .from('org_subscriptions')
      .select('org_id', { count: 'exact', head: true })
      .neq('tier', 'free'),
    sb
      .from('org_subscriptions')
      .select('org_id', { count: 'exact', head: true })
      .not('override_tier', 'is', null),
    sb.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(20),
  ]);

  if (users.error) throw new DbError(users.error);
  if (orgs.error) throw new DbError(orgs.error);
  if (tenancies.error) throw new DbError(tenancies.error);
  if (paid.error) throw new DbError(paid.error);
  if (overrides.error) throw new DbError(overrides.error);
  if (activity.error) throw new DbError(activity.error);

  return {
    counts: {
      users: users.count ?? 0,
      orgs: orgs.count ?? 0,
      active_tenancies: tenancies.count ?? 0,
      paid_subscriptions: paid.count ?? 0,
      overrides_active: overrides.count ?? 0,
    },
    recent_activity: (activity.data ?? []) as AdminAuditEntry[],
  };
}

export function getDashboardStats(ctx: HandlerContext): Promise<AdminDashboardStats> {
  return getDashboardStatsWithClient(ctx.supabase);
}
