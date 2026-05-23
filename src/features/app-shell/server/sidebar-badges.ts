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
}

const EMPTY: SidebarBadgeCounts = {
  unreadMessages: 0,
  unreadNotifications: 0,
  openTickets: 0,
};

/**
 * Load the three sidebar counters for the calling user.
 *
 * Pass `orgId` for landlord layouts (counts tickets in that org) and
 * leave it undefined for tenant layouts (counts tickets across all the
 * caller's tenancies).
 */
export async function loadSidebarBadgeCounts(
  supabase: SupabaseClient,
  options: { userId: string; orgId?: string } = { userId: '' },
): Promise<SidebarBadgeCounts> {
  const { userId, orgId } = options;
  if (!userId) return EMPTY;

  const [messagesResult, notificationsResult, ticketsResult] = await Promise.allSettled([
    countUnreadMessages(supabase),
    countUnreadNotifications(supabase),
    countOpenTickets(supabase, { userId, orgId }),
  ]);

  return {
    unreadMessages: settled(messagesResult),
    unreadNotifications: settled(notificationsResult),
    openTickets: settled(ticketsResult),
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
