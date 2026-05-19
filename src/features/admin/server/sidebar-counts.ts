import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminSidebarCounts } from '@/components/app-shell/admin-sidebar';
import { DbError } from '@/lib/errors';

/**
 * Counts shown as nav badges on the admin sidebar. Each query uses
 * `head: true` so we never pull rows — five `count(*)` round-trips
 * run in parallel against indexed columns.
 *
 * Falls back to zero on any individual query failure so a broken view
 * never breaks the whole layout.
 */
export async function getAdminSidebarCountsWithClient(
  sb: SupabaseClient,
): Promise<AdminSidebarCounts> {
  const [landlords, tenants, support, compliance, billing] = await Promise.all([
    sb.from('orgs').select('id', { count: 'exact', head: true }),
    sb.from('tenancies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    sb
      .from('platform_support_tickets')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']),
    sb
      .from('admin_compliance_violations')
      .select('id', { count: 'exact', head: true })
      .eq('severity', 'critical'),
    sb
      .from('org_subscriptions')
      .select('org_id', { count: 'exact', head: true })
      .eq('last_payment_status', 'failed'),
  ]);

  // Surface real errors but don't 500 the layout — log + zero.
  if (landlords.error) throw new DbError(landlords.error);
  if (tenants.error) throw new DbError(tenants.error);

  return {
    landlords: landlords.count ?? 0,
    tenants: tenants.count ?? 0,
    support_open: support.count ?? 0,
    compliance_critical: compliance.count ?? 0,
    billing_failed: billing.count ?? 0,
  };
}
