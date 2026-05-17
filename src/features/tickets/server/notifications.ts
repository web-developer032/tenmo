import 'server-only';
import {
  TICKET_CATEGORY_RULES,
  TICKET_SEVERITY_RULES,
  TICKET_STATUS_LABEL,
  type TicketStatus,
} from '@/core/constants/tickets';
import type { Ticket, TicketMessage } from '@/core/schemas/ticket';
import { markEmailDelivered, publishNotification } from '@/features/notifications/server';
import {
  renderTicketCreatedEmail,
  renderTicketMessageReceivedEmail,
  renderTicketStatusChangedEmail,
  sendEmail,
} from '@/lib/email';
import { publicEnv } from '@/lib/env.public';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Notifications for the maintenance ticket loop.
 *
 * Uses the service-role client to look up recipient emails because the
 * caller's session may not have RLS visibility into the *other* side
 * (e.g. a tenant comment must email the landlord — the tenant can't read
 * `org_memberships`).
 *
 * Each helper is fire-and-forget from the caller's POV: failures are
 * logged but never throw, since the database row is the source of truth.
 */

// Lazy logger — never call getLogger() at module import time so a single
// misconfigured optional env var can't crash any route that imports this
// module. The first call inside a request creates + caches it.
const log = () => getLogger().child({ module: 'tickets.notifications' });

type RecipientCtx = {
  ticket: Ticket;
  property_name: string;
  room_name: string | null;
  tenant_user_id: string | null;
  tenant_email: string | null;
  tenant_name: string | null;
  /**
   * Owner / agent / staff for the org (excluding the tenant). user_id may
   * be null for invited-but-not-yet-merged accounts; the email channel still
   * works in that case but the in-app row is skipped.
   */
  landlord_recipients: Array<{
    user_id: string | null;
    email: string;
    name: string | null;
  }>;
};

async function gatherRecipients(ticketId: string): Promise<RecipientCtx | null> {
  const sb = createServiceClient();

  const { data: ticketRow, error } = await sb
    .from('tickets')
    .select(
      `id, org_id, property_id, room_id, tenancy_id, title, description, category, severity, status,
       assigned_to_user_id, assigned_contractor, first_response_at, resolved_at, closed_at,
       reopened_count, ai_suggested_category, ai_suggested_severity, ai_triage_reason,
       created_by, created_at, updated_at,
       properties:property_id ( name ),
       rooms:room_id ( name ),
       tenancies:tenancy_id ( tenant_user_id, invite_email )`,
    )
    .eq('id', ticketId)
    .maybeSingle();

  if (error || !ticketRow) {
    log().warn({ err: error, ticketId }, 'recipient gather: ticket lookup failed');
    return null;
  }

  const property = pickFirst<{ name: string }>(ticketRow.properties);
  const room = pickFirst<{ name: string }>(ticketRow.rooms);
  const tenancy = pickFirst<{ tenant_user_id: string | null; invite_email: string | null }>(
    ticketRow.tenancies,
  );

  let tenantEmail: string | null = null;
  let tenantName: string | null = null;
  if (tenancy?.tenant_user_id) {
    const { data: profile } = await sb
      .from('profiles')
      .select('full_name, contact_email')
      .eq('id', tenancy.tenant_user_id)
      .maybeSingle();
    tenantEmail = profile?.contact_email ?? null;
    tenantName = profile?.full_name ?? null;
  }
  if (!tenantEmail) tenantEmail = tenancy?.invite_email ?? null;

  // Fetch landlord-side org members + their profile snippets in two
  // queries. We can't use a PostgREST embed here because
  // `org_memberships.user_id` foreign-keys `auth.users`, not
  // `public.profiles`, so PostgREST returns PGRST200.
  const { data: members } = await sb
    .from('org_memberships')
    .select('user_id, role')
    .eq('org_id', ticketRow.org_id)
    .is('revoked_at', null)
    .in('role', ['owner', 'agent', 'staff']);

  const landlordRecipients: RecipientCtx['landlord_recipients'] = [];
  const memberRows = members ?? [];
  if (memberRows.length > 0) {
    const memberIds = Array.from(new Set(memberRows.map((m) => m.user_id)));
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, full_name, contact_email')
      .in('id', memberIds);
    const profileById = new Map<
      string,
      { full_name: string | null; contact_email: string | null }
    >();
    for (const p of profiles ?? []) {
      profileById.set(p.id, { full_name: p.full_name, contact_email: p.contact_email });
    }
    for (const m of memberRows) {
      const p = profileById.get(m.user_id);
      if (p?.contact_email) {
        landlordRecipients.push({
          user_id: m.user_id,
          email: p.contact_email,
          name: p.full_name,
        });
      }
    }
  }

  return {
    ticket: ticketRow as unknown as Ticket,
    property_name: property?.name ?? 'your property',
    room_name: room?.name ?? null,
    tenant_user_id: tenancy?.tenant_user_id ?? null,
    tenant_email: tenantEmail,
    tenant_name: tenantName,
    landlord_recipients: landlordRecipients,
  };
}

function ticketUrl(ticket: Ticket, side: 'landlord' | 'tenant'): string {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  if (side === 'tenant') return `${base}/tenant/tickets/${ticket.id}`;
  return `${base}/landlord/tickets/${ticket.id}`;
}

/** Fire when a new ticket is created — emails go to landlord(s). */
export async function notifyTicketCreated(
  ticketId: string,
  raisedBy: { id: string },
): Promise<void> {
  const ctx = await gatherRecipients(ticketId);
  if (!ctx) return;

  // Look up the actor's display name. RLS-safe via service client.
  const sb = createServiceClient();
  const { data: actor } = await sb
    .from('profiles')
    .select('full_name')
    .eq('id', raisedBy.id)
    .maybeSingle();

  const severityRule = TICKET_SEVERITY_RULES[ctx.ticket.severity];
  const categoryLabel = TICKET_CATEGORY_RULES[ctx.ticket.category].label;
  const link = ticketUrl(ctx.ticket, 'landlord');
  const raisedByName = actor?.full_name ?? 'A tenant';

  for (const r of ctx.landlord_recipients) {
    if (r.email === ctx.tenant_email) continue; // dual-role: don't email yourself
    if (r.user_id === raisedBy.id) continue; // never notify the actor

    let notificationId: string | null = null;
    let shouldEmail = true;
    if (r.user_id) {
      const decision = await publishNotification({
        user_id: r.user_id,
        kind: 'ticket_created',
        title: `New ${ctx.ticket.severity} ticket — ${ctx.property_name}`,
        body: ctx.ticket.title,
        link_url: link,
        entity_type: 'ticket',
        entity_id: ctx.ticket.id,
        meta: {
          severity: ctx.ticket.severity,
          category: ctx.ticket.category,
          property_name: ctx.property_name,
          room_name: ctx.room_name,
          raised_by: raisedByName,
        },
      });
      notificationId = decision.notification_id;
      shouldEmail = decision.email;
    }

    if (!shouldEmail) continue;

    const rendered = renderTicketCreatedEmail({
      recipientEmail: r.email,
      recipientName: r.name,
      raisedByName: actor?.full_name ?? null,
      propertyName: ctx.property_name,
      roomName: ctx.room_name,
      ticketTitle: ctx.ticket.title,
      ticketDescription: ctx.ticket.description,
      severityLabel: severityRule.label,
      severityKey: ctx.ticket.severity,
      categoryLabel,
      ticketUrl: link,
    });
    const result = await sendEmail({
      to: r.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [
        { name: 'channel', value: 'ticket-created' },
        { name: 'severity', value: ctx.ticket.severity },
      ],
    });
    if (!result.ok) {
      log().warn({ recipient: r.email, error: result.error }, 'ticket-created email failed');
    } else if (notificationId) {
      await markEmailDelivered(notificationId);
    }
  }
}

/** Fire when a comment is added — email the *other* party. */
export async function notifyTicketMessage(ticketId: string, message: TicketMessage): Promise<void> {
  if (message.kind !== 'comment') return;
  const ctx = await gatherRecipients(ticketId);
  if (!ctx) return;

  const sb = createServiceClient();
  const { data: author } = message.author_user_id
    ? await sb.from('profiles').select('full_name').eq('id', message.author_user_id).maybeSingle()
    : { data: null };

  const authorIsTenant =
    ctx.ticket.tenancy_id !== null &&
    message.author_user_id !== null &&
    (await isTenantOfTicket(message.author_user_id, ctx.ticket.tenancy_id));

  const authorName = author?.full_name ?? (authorIsTenant ? 'Your tenant' : 'Your landlord');
  const messagePreview = message.body;

  if (authorIsTenant) {
    const link = ticketUrl(ctx.ticket, 'landlord');
    for (const r of ctx.landlord_recipients) {
      if (r.email === ctx.tenant_email) continue;
      if (r.user_id === message.author_user_id) continue;

      let notificationId: string | null = null;
      let shouldEmail = true;
      if (r.user_id) {
        const decision = await publishNotification({
          user_id: r.user_id,
          kind: 'ticket_message',
          title: `${authorName} replied — ${ctx.ticket.title}`,
          body: messagePreview,
          link_url: link,
          entity_type: 'ticket',
          entity_id: ctx.ticket.id,
          meta: { author_role: 'tenant', property_name: ctx.property_name },
        });
        notificationId = decision.notification_id;
        shouldEmail = decision.email;
      }

      if (!shouldEmail) continue;

      const rendered = renderTicketMessageReceivedEmail({
        recipientEmail: r.email,
        recipientName: r.name,
        authorName,
        authorRole: 'tenant',
        propertyName: ctx.property_name,
        roomName: ctx.room_name,
        ticketTitle: ctx.ticket.title,
        messagePreview,
        ticketUrl: link,
      });
      const result = await sendEmail({
        to: r.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        tags: [{ name: 'channel', value: 'ticket-message' }],
      });
      if (!result.ok) {
        log().warn({ recipient: r.email, error: result.error }, 'ticket-message email failed');
      } else if (notificationId) {
        await markEmailDelivered(notificationId);
      }
    }
  } else if (ctx.tenant_email) {
    const link = ticketUrl(ctx.ticket, 'tenant');

    let notificationId: string | null = null;
    let shouldEmail = true;
    if (ctx.tenant_user_id) {
      const decision = await publishNotification({
        user_id: ctx.tenant_user_id,
        kind: 'ticket_message',
        title: `${authorName} replied — ${ctx.ticket.title}`,
        body: messagePreview,
        link_url: link,
        entity_type: 'ticket',
        entity_id: ctx.ticket.id,
        meta: { author_role: 'landlord', property_name: ctx.property_name },
      });
      notificationId = decision.notification_id;
      shouldEmail = decision.email;
    }

    if (!shouldEmail) return;

    const rendered = renderTicketMessageReceivedEmail({
      recipientEmail: ctx.tenant_email,
      recipientName: ctx.tenant_name,
      authorName,
      authorRole: 'landlord',
      propertyName: ctx.property_name,
      roomName: ctx.room_name,
      ticketTitle: ctx.ticket.title,
      messagePreview,
      ticketUrl: link,
    });
    const result = await sendEmail({
      to: ctx.tenant_email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [{ name: 'channel', value: 'ticket-message' }],
    });
    if (!result.ok) {
      log().warn(
        { recipient: ctx.tenant_email, error: result.error },
        'ticket-message email failed',
      );
    } else if (notificationId) {
      await markEmailDelivered(notificationId);
    }
  }
}

/** Fire when status changes — always email the tenant. */
export async function notifyTicketStatusChanged(
  ticketId: string,
  fromStatus: TicketStatus,
  toStatus: TicketStatus,
  note: string | null,
): Promise<void> {
  const ctx = await gatherRecipients(ticketId);
  if (!ctx?.tenant_email) return;

  const link = ticketUrl(ctx.ticket, 'tenant');
  const fromLabel = TICKET_STATUS_LABEL[fromStatus];
  const toLabel = TICKET_STATUS_LABEL[toStatus];

  let notificationId: string | null = null;
  let shouldEmail = true;
  if (ctx.tenant_user_id) {
    const decision = await publishNotification({
      user_id: ctx.tenant_user_id,
      kind: 'ticket_status_changed',
      title: `${ctx.ticket.title} — now ${toLabel}`,
      body: note ?? `Status moved from ${fromLabel} to ${toLabel}.`,
      link_url: link,
      entity_type: 'ticket',
      entity_id: ctx.ticket.id,
      meta: {
        from_status: fromStatus,
        to_status: toStatus,
        property_name: ctx.property_name,
      },
    });
    notificationId = decision.notification_id;
    shouldEmail = decision.email;
  }

  if (!shouldEmail) return;

  const rendered = renderTicketStatusChangedEmail({
    recipientEmail: ctx.tenant_email,
    recipientName: ctx.tenant_name,
    propertyName: ctx.property_name,
    roomName: ctx.room_name,
    ticketTitle: ctx.ticket.title,
    fromStatusLabel: fromLabel,
    toStatusLabel: toLabel,
    toStatusKey: toStatus,
    note,
    ticketUrl: link,
  });

  const result = await sendEmail({
    to: ctx.tenant_email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    tags: [
      { name: 'channel', value: 'ticket-status' },
      { name: 'status', value: toStatus },
    ],
  });
  if (!result.ok) {
    log().warn({ recipient: ctx.tenant_email, error: result.error }, 'ticket-status email failed');
  } else if (notificationId) {
    await markEmailDelivered(notificationId);
  }
}

async function isTenantOfTicket(userId: string, tenancyId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('tenancies')
    .select('id')
    .eq('id', tenancyId)
    .eq('tenant_user_id', userId)
    .maybeSingle();
  return Boolean(data);
}

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}
