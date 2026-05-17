import 'server-only';
import { Ticket, type TicketListFilter } from '@/core/schemas/ticket';
import type { HandlerContext } from '@/lib/handler';

export type TicketRow = Ticket;

/**
 * List tickets for an org. RLS scopes results, so this is just for query
 * efficiency + consistent ordering.
 *
 * Default ordering: open tickets first (kanban-friendly), then by severity
 * (critical → low), then by created_at desc.
 */
export async function listOrgTickets(
  ctx: HandlerContext,
  orgId: string,
  filter: TicketListFilter = {},
): Promise<TicketRow[]> {
  let query = ctx.supabase
    .from('tickets')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (filter.status) query = query.eq('status', filter.status);
  if (filter.severity) query = query.eq('severity', filter.severity);
  if (filter.category) query = query.eq('category', filter.category);
  if (filter.property_id) query = query.eq('property_id', filter.property_id);
  if (filter.tenancy_id) query = query.eq('tenancy_id', filter.tenancy_id);
  if (filter.assigned_to_user_id)
    query = query.eq('assigned_to_user_id', filter.assigned_to_user_id);
  if (filter.open_only) {
    query = query.not('status', 'in', '(closed,cancelled)');
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => Ticket.parse(row));
}

/**
 * List tickets for a tenant — RLS already restricts to their own tenancies,
 * but we add an explicit filter so the query plan is tight.
 */
export async function listTenantTickets(
  ctx: HandlerContext,
  tenantUserId: string,
  filter: TicketListFilter = {},
): Promise<TicketRow[]> {
  const { data: tenancies, error: tenErr } = await ctx.supabase
    .from('tenancies')
    .select('id')
    .eq('tenant_user_id', tenantUserId);
  if (tenErr) throw tenErr;

  const tenancyIds = (tenancies ?? []).map((t) => t.id);
  if (tenancyIds.length === 0) return [];

  let query = ctx.supabase
    .from('tickets')
    .select('*')
    .in('tenancy_id', tenancyIds)
    .order('created_at', { ascending: false });

  if (filter.status) query = query.eq('status', filter.status);
  if (filter.severity) query = query.eq('severity', filter.severity);
  if (filter.tenancy_id) query = query.eq('tenancy_id', filter.tenancy_id);
  if (filter.open_only) {
    query = query.not('status', 'in', '(closed,cancelled)');
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => Ticket.parse(row));
}
