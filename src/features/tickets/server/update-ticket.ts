import 'server-only';
import {
  type AddTicketMessageInput,
  type AssignTicketInput,
  type ChangeTicketStatusInput,
  Ticket,
  TicketMessage,
} from '@/core/schemas/ticket';
import { canTransition, type TicketActorRole } from '@/core/utils/ticket-rules';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';
import { notifyTicketMessage, notifyTicketStatusChanged } from './notifications';

/**
 * Resolve which side of the relationship the current user is acting as for
 * a given ticket — used to decide which transitions are allowed.
 *
 * Order matters: landlord roles take precedence (an owner who happens to
 * also be a tenant on the same property still acts as a landlord here).
 */
export async function resolveActorRole(
  ctx: HandlerContext,
  ticketId: string,
): Promise<TicketActorRole> {
  if (!ctx.user) throw new BusinessRuleError('Not authenticated');

  const { data: ticket, error } = await ctx.supabase
    .from('tickets')
    .select('id, org_id, tenancy_id')
    .eq('id', ticketId)
    .maybeSingle();
  if (error) throw new DbError(error);
  if (!ticket) throw new NotFoundError('Ticket not found');

  const { data: membership } = await ctx.supabase
    .from('org_memberships')
    .select('role')
    .eq('org_id', ticket.org_id)
    .eq('user_id', ctx.user.id)
    .is('revoked_at', null)
    .maybeSingle();

  if (membership && ['owner', 'agent', 'staff'].includes(membership.role)) {
    return 'landlord';
  }
  return 'tenant';
}

/**
 * Append a comment + optional attachments to an existing ticket. Uses the
 * `add_ticket_message` SQL helper so first_response_at is maintained.
 */
export async function addTicketMessage(
  ctx: HandlerContext,
  ticketId: string,
  input: AddTicketMessageInput,
): Promise<TicketMessage> {
  const { data, error } = await ctx.supabase.rpc('add_ticket_message', {
    p_ticket_id: ticketId,
    p_body: input.body,
    p_attachment_paths: input.attachment_paths,
  });
  if (error) throw new DbError(error);
  if (!data) throw new NotFoundError('Ticket not found');
  const message = TicketMessage.parse(data);

  notifyTicketMessage(ticketId, message).catch((err) => {
    ctx.log.warn({ err, ticketId }, 'notifyTicketMessage failed');
  });

  return message;
}

/**
 * Change a ticket's status, enforcing the role-aware state machine. Calls
 * `change_ticket_status` so the audit message is always written.
 */
export async function changeTicketStatus(
  ctx: HandlerContext,
  ticketId: string,
  role: TicketActorRole,
  input: ChangeTicketStatusInput,
): Promise<Ticket> {
  const { data: current, error: getErr } = await ctx.supabase
    .from('tickets')
    .select('id, status')
    .eq('id', ticketId)
    .maybeSingle();
  if (getErr) throw new DbError(getErr);
  if (!current) throw new NotFoundError('Ticket not found');

  if (!canTransition(current.status, input.status, role)) {
    throw new BusinessRuleError(
      `Cannot move ticket from ${current.status} to ${input.status} as a ${role}.`,
    );
  }

  const { data: updated, error: rpcErr } = await ctx.supabase.rpc('change_ticket_status', {
    p_ticket_id: ticketId,
    p_status: input.status,
    p_note: input.note ?? null,
  });
  if (rpcErr) throw new DbError(rpcErr);
  if (!updated) throw new NotFoundError('Ticket not found');
  const ticket = Ticket.parse(updated);

  if (current.status !== ticket.status) {
    notifyTicketStatusChanged(ticketId, current.status, ticket.status, input.note ?? null).catch(
      (err) => {
        ctx.log.warn({ err, ticketId }, 'notifyTicketStatusChanged failed');
      },
    );
  }

  return ticket;
}

/** Assign / re-assign a ticket. Landlord-only path. */
export async function assignTicket(
  ctx: HandlerContext,
  ticketId: string,
  input: AssignTicketInput,
): Promise<Ticket> {
  const { data, error } = await ctx.supabase.rpc('assign_ticket', {
    p_ticket_id: ticketId,
    p_user_id: input.assigned_to_user_id ?? null,
    p_contractor: input.assigned_contractor ?? null,
  });
  if (error) throw new DbError(error);
  if (!data) throw new NotFoundError('Ticket not found');
  return Ticket.parse(data);
}
