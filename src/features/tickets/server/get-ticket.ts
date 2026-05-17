import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Ticket, TicketMessage } from '@/core/schemas/ticket';
import { DbError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

export type TicketDetail = {
  ticket: Ticket;
  messages: TicketMessage[];
  /** Names + emails of message authors, keyed by user id, for the UI. */
  authors: Record<string, { full_name: string | null; contact_email: string | null }>;
  /** Property + room names so we don't need extra round-trips in pages. */
  property_name: string;
  room_name: string | null;
};

/**
 * Load a ticket and its full message timeline.
 *
 * Returns null if the ticket is not visible to the caller (RLS).
 */
export async function loadTicketDetail(
  ctx: HandlerContext,
  ticketId: string,
): Promise<TicketDetail | null> {
  const { data: ticketRow, error: tErr } = await ctx.supabase
    .from('tickets')
    .select(
      'id, org_id, property_id, room_id, tenancy_id, title, description, category, severity, status, assigned_to_user_id, assigned_contractor, first_response_at, resolved_at, closed_at, reopened_count, ai_suggested_category, ai_suggested_severity, ai_triage_reason, created_by, created_at, updated_at, properties:property_id ( name ), rooms:room_id ( name )',
    )
    .eq('id', ticketId)
    .maybeSingle();
  if (tErr) throw new DbError(tErr);
  if (!ticketRow) return null;

  const property = pickFirst<{ name: string }>(
    (ticketRow as unknown as Record<string, unknown>).properties,
  );
  const room = pickFirst<{ name: string }>((ticketRow as unknown as Record<string, unknown>).rooms);

  const ticket = Ticket.parse({
    id: ticketRow.id,
    org_id: ticketRow.org_id,
    property_id: ticketRow.property_id,
    room_id: ticketRow.room_id,
    tenancy_id: ticketRow.tenancy_id,
    title: ticketRow.title,
    description: ticketRow.description,
    category: ticketRow.category,
    severity: ticketRow.severity,
    status: ticketRow.status,
    assigned_to_user_id: ticketRow.assigned_to_user_id,
    assigned_contractor: ticketRow.assigned_contractor,
    first_response_at: ticketRow.first_response_at,
    resolved_at: ticketRow.resolved_at,
    closed_at: ticketRow.closed_at,
    reopened_count: ticketRow.reopened_count,
    ai_suggested_category: ticketRow.ai_suggested_category,
    ai_suggested_severity: ticketRow.ai_suggested_severity,
    ai_triage_reason: ticketRow.ai_triage_reason,
    created_by: ticketRow.created_by,
    created_at: ticketRow.created_at,
    updated_at: ticketRow.updated_at,
  });

  const { data: msgRows, error: mErr } = await ctx.supabase
    .from('ticket_messages')
    .select('*')
    .eq('ticket_id', ticket.id)
    .order('created_at', { ascending: true });
  if (mErr) throw new DbError(mErr);

  const messages = (msgRows ?? []).map((m) => TicketMessage.parse(m));
  const authorIds = unique(
    messages.map((m) => m.author_user_id).filter((id): id is string => id !== null),
  );

  const authors = await loadAuthors(ctx.supabase, authorIds);

  return {
    ticket,
    messages,
    authors,
    property_name: property?.name ?? 'Property',
    room_name: room?.name ?? null,
  };
}

async function loadAuthors(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<TicketDetail['authors']> {
  if (userIds.length === 0) return {};
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, contact_email')
    .in('id', userIds);
  if (error) {
    // Names are best-effort; don't fail the whole page over them.
    return {};
  }
  const map: TicketDetail['authors'] = {};
  for (const row of data ?? []) {
    map[row.id] = { full_name: row.full_name, contact_email: row.contact_email };
  }
  return map;
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function pickFirst<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  if (value && typeof value === 'object') return value as T;
  return null;
}
