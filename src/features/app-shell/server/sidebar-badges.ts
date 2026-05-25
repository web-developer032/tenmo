import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared sidebar-badge loader.
 *
 * Layouts (landlord + tenant) call this once per request to populate
 * the unread-messages / unread-notifications / open-tickets pills in
 * their sidebar nav. Centralising the three lookups avoids duplicated
 * RPC code in every layout and guarantees they stay in sync.
 *
 * Each lookup is failure-isolated: a single RPC error returns 0 for
 * that pill rather than 500-ing the whole layout. The layout is on the
 * critical render path — we never want a missing badge to blank the
 * entire workspace.
 */

export interface SidebarBadgeCounts {
  unreadMessages: number;
  unreadNotifications: number;
  openTickets: number;
  /** Landlord-only — vacant rooms with an active or draft listing. */
  vacantListings: number;
  /** Landlord-only — overdue rent_charges in the active month. */
  overdueRent: number;
  /** Landlord-only — compliance items expiring in the next 30 days or already overdue. */
  expiringCompliance: number;
  /** Landlord-only — RtR records with a re-check due in the next 60 days or already expired. */
  rtrRechecksDue: number;
}

const EMPTY: SidebarBadgeCounts = {
  unreadMessages: 0,
  unreadNotifications: 0,
  openTickets: 0,
  vacantListings: 0,
  overdueRent: 0,
  expiringCompliance: 0,
  rtrRechecksDue: 0,
};

/**
 * Load the sidebar counters for the calling user.
 *
 * The first three pills (messages / notifications / tickets) work for both
 * landlord and tenant sidebars. The remaining four are landlord-specific
 * and stay at 0 when `orgId` is omitted.
 */
export async function loadSidebarBadgeCounts(
  supabase: SupabaseClient,
  options: { userId: string; orgId?: string } = { userId: '' },
): Promise<SidebarBadgeCounts> {
  const { userId, orgId } = options;
  if (!userId) return EMPTY;

  const [
    messagesResult,
    notificationsResult,
    ticketsResult,
    vacantListingsResult,
    overdueRentResult,
    expiringComplianceResult,
    rtrRechecksDueResult,
  ] = await Promise.allSettled([
    countUnreadMessages(supabase),
    countUnreadNotifications(supabase),
    countOpenTickets(supabase, { userId, orgId }),
    orgId ? countVacantListings(supabase, orgId) : Promise.resolve(0),
    orgId ? countOverdueRent(supabase, orgId) : Promise.resolve(0),
    orgId ? countExpiringCompliance(supabase, orgId) : Promise.resolve(0),
    orgId ? countRtrRechecksDue(supabase, orgId) : Promise.resolve(0),
  ]);

  return {
    unreadMessages: settled(messagesResult),
    unreadNotifications: settled(notificationsResult),
    openTickets: settled(ticketsResult),
    vacantListings: settled(vacantListingsResult),
    overdueRent: settled(overdueRentResult),
    expiringCompliance: settled(expiringComplianceResult),
    rtrRechecksDue: settled(rtrRechecksDueResult),
  };
}

function settled(result: PromiseSettledResult<number>): number {
  return result.status === 'fulfilled' ? result.value : 0;
}

async function countUnreadMessages(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc('unread_messages_count');
  if (error) throw error;
  return Number(data ?? 0);
}

async function countUnreadNotifications(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc('unread_notifications_count');
  if (error) throw error;
  return Number(data ?? 0);
}

const OPEN_TICKET_STATUSES = [
  'open',
  'triaged',
  'in_progress',
  'awaiting_tenant',
  'awaiting_contractor',
];

async function countOpenTickets(
  supabase: SupabaseClient,
  options: { userId: string; orgId?: string },
): Promise<number> {
  if (options.orgId) {
    const { count, error } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', options.orgId)
      .in('status', OPEN_TICKET_STATUSES);
    if (error) throw error;
    return count ?? 0;
  }

  // Tenant mode — scope to tenancies owned by the caller.
  const { data: tenancies, error: tenanciesError } = await supabase
    .from('tenancies')
    .select('id')
    .eq('tenant_user_id', options.userId);
  if (tenanciesError) throw tenanciesError;

  const tenancyIds = (tenancies ?? []).map((t: { id: string }) => t.id);
  if (tenancyIds.length === 0) return 0;

  const { count, error } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .in('tenancy_id', tenancyIds)
    .in('status', OPEN_TICKET_STATUSES);
  if (error) throw error;
  return count ?? 0;
}

// Landlord-only counters --------------------------------------------------

async function countVacantListings(supabase: SupabaseClient, orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from('rooms')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'available')
    .in('listing_status', ['published', 'draft']);
  if (error) throw error;
  return count ?? 0;
}

async function countOverdueRent(supabase: SupabaseClient, orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from('rent_charges')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'overdue');
  if (error) throw error;
  return count ?? 0;
}

async function countExpiringCompliance(supabase: SupabaseClient, orgId: string): Promise<number> {
  // Count anything either overdue or due in the next 30 days. Status is
  // computed by `trg_compliance_items_status` so we trust the column.
  const { count, error } = await supabase
    .from('compliance_items')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .in('status', ['overdue', 'due_soon']);
  if (error) throw error;
  return count ?? 0;
}

async function countRtrRechecksDue(supabase: SupabaseClient, orgId: string): Promise<number> {
  // Read the derived view from the landlord-ops migration — surfaces both
  // expired and recheck_due states in a single column.
  const { count, error } = await supabase
    .from('landlord_rtr_view')
    .select('tenancy_id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .in('rtr_state', ['expired', 'recheck_due']);
  if (error) throw error;
  return count ?? 0;
}
