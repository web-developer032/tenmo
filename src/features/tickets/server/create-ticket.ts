import 'server-only';
import { type CreateTicketInput, Ticket, TicketMessage } from '@/core/schemas/ticket';
import { triageTicket } from '@/core/utils/ticket-rules';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';
import { notifyTicketCreated } from './notifications';

export type CreateTicketResult = {
  ticket: Ticket;
  message: TicketMessage;
};

/**
 * Create a ticket atomically with its first message.
 *
 * Behaviour:
 *  - Resolves `org_id` from the supplied `property_id` (we never trust the
 *    client to set it).
 *  - Verifies that `tenancy_id` (if supplied) belongs to that property —
 *    prevents a tenant of property A from filing tickets against property B.
 *  - Runs the AI triage stub and stores the suggestion alongside the user's
 *    explicit choice. If the user didn't pick a category/severity, the
 *    suggestion becomes the value.
 *  - Inserts via the `create_ticket` SQL helper so the ticket and its first
 *    `comment` message are atomic and the audit trail is consistent.
 */
export async function createTicket(
  ctx: HandlerContext,
  input: CreateTicketInput,
  user: { id: string },
): Promise<CreateTicketResult> {
  const { data: property, error: propErr } = await ctx.supabase
    .from('properties')
    .select('id, org_id')
    .eq('id', input.property_id)
    .maybeSingle();
  if (propErr) throw new DbError(propErr);
  if (!property) throw new NotFoundError('Property not found');

  if (input.tenancy_id) {
    const { data: tenancy, error: tenErr } = await ctx.supabase
      .from('tenancies')
      .select('id, org_id, property_id, room_id, tenant_user_id')
      .eq('id', input.tenancy_id)
      .maybeSingle();
    if (tenErr) throw new DbError(tenErr);
    if (!tenancy) throw new NotFoundError('Tenancy not found');
    if (tenancy.property_id !== property.id) {
      throw new BusinessRuleError('Tenancy does not belong to this property');
    }
    if (input.room_id && tenancy.room_id !== input.room_id) {
      throw new BusinessRuleError('Tenancy does not occupy that room');
    }
  }

  const triage = triageTicket({ title: input.title, description: input.description });

  const category = input.category ?? triage.category;
  const severity = input.severity ?? triage.severity;

  const { data: created, error: createErr } = await ctx.supabase.rpc('create_ticket', {
    p_org_id: property.org_id,
    p_property_id: property.id,
    p_room_id: input.room_id ?? null,
    p_tenancy_id: input.tenancy_id ?? null,
    p_title: input.title,
    p_description: input.description,
    p_category: category,
    p_severity: severity,
    p_attachment_paths: input.attachment_paths,
  });
  if (createErr) throw new DbError(createErr);

  const ticketRow = Ticket.parse(created);

  // Persist the AI suggestion alongside the human pick. Triggers update
  // updated_at; this is also a chance to backfill if RLS lets us.
  const { data: enriched, error: updErr } = await ctx.supabase
    .from('tickets')
    .update({
      ai_suggested_category: triage.category,
      ai_suggested_severity: triage.severity,
      ai_triage_reason: triage.reason,
    })
    .eq('id', ticketRow.id)
    .select('*')
    .maybeSingle();
  if (updErr) {
    ctx.log.warn({ err: updErr, ticketId: ticketRow.id }, 'failed to persist AI triage suggestion');
  }

  const finalTicket = enriched ? Ticket.parse(enriched) : ticketRow;

  const { data: msgRow, error: msgErr } = await ctx.supabase
    .from('ticket_messages')
    .select('*')
    .eq('ticket_id', finalTicket.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (msgErr) throw new DbError(msgErr);
  if (!msgRow) throw new DbError(new Error('Ticket created without first message'));

  ctx.log.info(
    { ticketId: finalTicket.id, createdBy: user.id, severity, category, triage },
    'ticket created',
  );

  // Fire-and-forget — never block the user response on email delivery.
  notifyTicketCreated(finalTicket.id, user).catch((err) => {
    ctx.log.warn({ err, ticketId: finalTicket.id }, 'notifyTicketCreated failed');
  });

  return { ticket: finalTicket, message: TicketMessage.parse(msgRow) };
}
