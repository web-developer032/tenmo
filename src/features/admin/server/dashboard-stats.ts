import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminAuditEntry } from '@/core/schemas/admin';
import { DbError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Top-line KPIs + recent admin audit for the `/admin` landing page,
 * plus the data the redesigned Platform Dashboard needs:
 *
 *   - MRR (this month and last) computed from `mrr_snapshots`
 *   - Plan breakdown (count per effective tier) from `admin_plan_breakdown`
 *   - 12-month MRR + signups series for the bar charts
 *   - Recent landlord signups (last 4) from `admin_org_summary`
 *   - Most recent open platform support tickets (last 4)
 *
 * Every count uses `head: true` so we never load whole rows; views are
 * pre-aggregated server-side. Failures of the dashboard view (e.g. the
 * compliance view returning an error) downgrade to zero rather than
 * blowing up the entire dashboard.
 */

export type PlanBreakdownRow = {
  tier: string;
  status: string;
  landlord_count: number;
  mrr_pence: number;
};

export type RecentSignupRow = {
  org_id: string;
  org_name: string;
  org_slug: string;
  owner_name: string | null;
  tier: string | null;
  status: string | null;
  property_count: number;
  created_at: string;
};

export type OpenTicketRow = {
  id: string;
  ref_number: number;
  title: string;
  category: string;
  priority: 'low' | 'med' | 'high';
  status: 'open' | 'in_progress' | 'resolved';
  reporter_name: string | null;
  created_at: string;
};

export type MrrPoint = {
  month_start: string;
  mrr_pence: number;
  paying_landlords: number;
  signups: number;
};

export interface AdminDashboardStats {
  counts: {
    users: number;
    orgs: number;
    active_tenancies: number;
    paid_subscriptions: number;
    overrides_active: number;
    support_open: number;
    properties: number;
    signups_today: number;
    compliance_critical: number;
  };
  mrr: {
    current_pence: number;
    previous_pence: number;
    delta_pct: number | null;
    arr_pence: number;
  };
  series: {
    mrr: MrrPoint[];
  };
  plan_breakdown: PlanBreakdownRow[];
  recent_signups: RecentSignupRow[];
  open_tickets: OpenTicketRow[];
  recent_activity: AdminAuditEntry[];
}

export async function getDashboardStatsWithClient(
  sb: SupabaseClient,
): Promise<AdminDashboardStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  const [
    users,
    orgs,
    tenancies,
    paid,
    overrides,
    activity,
    mrrSeries,
    planBreakdown,
    recentSignups,
    openTickets,
    supportOpen,
    propertiesCount,
    signupsToday,
    complianceCritical,
  ] = await Promise.all([
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
    sb
      .from('mrr_snapshots')
      .select('month_start, mrr_pence, paying_landlords, signups')
      .order('month_start', { ascending: true })
      .limit(12),
    sb.from('admin_plan_breakdown').select('tier, status, landlord_count, mrr_pence'),
    sb
      .from('admin_org_summary')
      .select('org_id, name, slug, owner_name, tier, status, property_count, created_at')
      .order('created_at', { ascending: false })
      .limit(4),
    sb
      .from('platform_support_tickets')
      .select(
        'id, ref_number, title, category, priority, status, created_at, profiles:reporter_user_id(full_name)',
      )
      .in('status', ['open', 'in_progress'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(4),
    sb
      .from('platform_support_tickets')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']),
    sb.from('properties').select('id', { count: 'exact', head: true }).is('archived_at', null),
    sb.from('orgs').select('id', { count: 'exact', head: true }).gte('created_at', todayStartIso),
    sb
      .from('admin_compliance_violations')
      .select('id', { count: 'exact', head: true })
      .eq('severity', 'critical'),
  ]);

  if (users.error) throw new DbError(users.error);
  if (orgs.error) throw new DbError(orgs.error);
  if (tenancies.error) throw new DbError(tenancies.error);
  if (paid.error) throw new DbError(paid.error);
  if (overrides.error) throw new DbError(overrides.error);
  if (activity.error) throw new DbError(activity.error);

  const series: MrrPoint[] = (mrrSeries.data ?? []).map((row) => ({
    month_start: row.month_start as string,
    mrr_pence: Number(row.mrr_pence ?? 0),
    paying_landlords: Number(row.paying_landlords ?? 0),
    signups: Number(row.signups ?? 0),
  }));

  const currentMrr = series.at(-1)?.mrr_pence ?? 0;
  const previousMrr = series.at(-2)?.mrr_pence ?? 0;
  const deltaPct =
    previousMrr > 0 ? Math.round(((currentMrr - previousMrr) / previousMrr) * 1000) / 10 : null;

  return {
    counts: {
      users: users.count ?? 0,
      orgs: orgs.count ?? 0,
      active_tenancies: tenancies.count ?? 0,
      paid_subscriptions: paid.count ?? 0,
      overrides_active: overrides.count ?? 0,
      support_open: supportOpen.count ?? 0,
      properties: propertiesCount.count ?? 0,
      signups_today: signupsToday.count ?? 0,
      compliance_critical: complianceCritical.count ?? 0,
    },
    mrr: {
      current_pence: currentMrr,
      previous_pence: previousMrr,
      delta_pct: deltaPct,
      arr_pence: currentMrr * 12,
    },
    series: { mrr: series },
    plan_breakdown: ((planBreakdown.data ?? []) as PlanBreakdownRow[]).map((r) => ({
      tier: r.tier,
      status: r.status,
      landlord_count: Number(r.landlord_count ?? 0),
      mrr_pence: Number(r.mrr_pence ?? 0),
    })),
    recent_signups: ((recentSignups.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      org_id: r.org_id as string,
      org_name: r.name as string,
      org_slug: r.slug as string,
      owner_name: (r.owner_name as string | null) ?? null,
      tier: (r.tier as string | null) ?? null,
      status: (r.status as string | null) ?? null,
      property_count: Number(r.property_count ?? 0),
      created_at: r.created_at as string,
    })),
    open_tickets: ((openTickets.data ?? []) as Array<Record<string, unknown>>).map((r) => {
      const profile = r.profiles as { full_name: string | null } | null;
      return {
        id: r.id as string,
        ref_number: Number(r.ref_number ?? 0),
        title: r.title as string,
        category: r.category as string,
        priority: r.priority as 'low' | 'med' | 'high',
        status: r.status as 'open' | 'in_progress' | 'resolved',
        reporter_name: profile?.full_name ?? null,
        created_at: r.created_at as string,
      };
    }),
    recent_activity: (activity.data ?? []) as AdminAuditEntry[],
  };
}

export function getDashboardStats(ctx: HandlerContext): Promise<AdminDashboardStats> {
  return getDashboardStatsWithClient(ctx.supabase);
}
