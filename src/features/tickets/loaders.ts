import 'server-only';
import { z } from 'zod';
import { uuid } from '@/core/schemas/common';
import { Ticket, TicketMessage } from '@/core/schemas/ticket';
import {
  compareTicketsForBoard,
  groupByStatus,
  summariseTickets,
  type TicketStats,
} from '@/core/utils/ticket-rules';
import { loadProfilesByUserIds } from '@/features/profile/server';
import { createClient } from '@/lib/supabase/server';

/** Tenancy "places I can raise an issue against" — used by the new-ticket form. */
export type TenantTenancyOption = {
  tenancy_id: string;
  property_id: string;
  property_name: string;
  room_id: string | null;
  room_name: string | null;
};

/** Org members eligible to be assigned a ticket — landlord-side only. */
export type OrgAssignmentMember = {
  id: string;
  full_name: string | null;
  contact_email: string | null;
  role: string;
};

/**
 * Active members of an org (owner, agent, staff) — used by the landlord
 * assignment panel. RLS lets any member of an org read other members'
 * rows via the membership policy.
 *
 * NOTE: We deliberately do *not* use a PostgREST embed on `profiles`
 * here — `org_memberships.user_id` foreign-keys `auth.users(id)`, not
 * `profiles(id)`, so PostgREST can't resolve a `profiles:user_id (...)`
 * relationship and returns PGRST200. Instead we fetch profiles in a
 * second query and stitch them together client-side, mirroring the
 * approach in `features/admin/server/list-users.ts`.
 */
export async function loadOrgAssignmentMembers(orgId: string): Promise<OrgAssignmentMember[]> {
  const supabase = await createClient();
  const { data: memberships, error } = await supabase
    .from('org_memberships')
    .select('user_id, role')
    .eq('org_id', orgId)
    .is('revoked_at', null)
    .in('role', ['owner', 'agent', 'staff']);
  if (error) throw error;

  const rows = memberships ?? [];
  const userIds = unique(rows.map((r) => r.user_id));
  const profiles = await loadProfilesByUserIds(supabase, userIds);

  return rows.map((row) => {
    const profile = profiles.get(row.user_id);
    return {
      id: row.user_id,
      full_name: profile?.full_name ?? null,
      contact_email: profile?.contact_email ?? null,
      role: row.role,
    };
  });
}

/**
 * Tenancies the current tenant can raise tickets against. We only return
 * tenancies in a "lived-in" state — pending invites and awaiting-signature
 * tenancies aren't ticket-able yet.
 *
 * RLS would already restrict to the user's own tenancies, but we're explicit
 * about the user_id filter because we run this with the request-bound client.
 */
export async function loadTenantTenancyOptions(
  tenantUserId: string,
): Promise<TenantTenancyOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tenancies')
    .select(
      `id, status, property_id, room_id,
       properties:property_id (name),
       rooms:room_id (name)`,
    )
    .eq('tenant_user_id', tenantUserId)
    .in('status', ['active', 'awaiting_deposit', 'awaiting_signature'])
    .order('start_date', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const property = pickFirst<{ name: string }>(row.properties);
    const room = pickFirst<{ name: string }>(row.rooms);
    return {
      tenancy_id: row.id,
      property_id: row.property_id,
      property_name: property?.name ?? 'Property',
      room_id: row.room_id,
      room_name: room?.name ?? null,
    };
  });
}

/**
 * Server-only loaders for the maintenance ticket UI. RLS scopes results, so
 * each function must run on the server with an authenticated user.
 *
 * These are pure read helpers — mutating operations live in `./server/*`.
 */

export type TicketWithContext = Ticket & {
  property_name: string | null;
  room_name: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
};

export type TicketBoardData = {
  tickets: TicketWithContext[];
  byStatus: Record<string, TicketWithContext[]>;
  stats: TicketStats;
};

/**
 * Org-side kanban + dashboard data. Pulls every ticket the caller can see
 * for the org, hydrates with property/room/tenant context, and pre-groups
 * for the board UI.
 */
export async function loadOrgTicketsBoard(orgId: string): Promise<TicketBoardData> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from('tickets')
    .select(
      `*,
       properties:property_id (name),
       rooms:room_id (name),
       tenancies:tenancy_id (tenant_user_id, invite_email)`,
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const tickets = (rows ?? []).map((raw) => hydrateTicket(raw));

  // Resolve tenant display names by joining to profiles in a single round-trip.
  const tenantUserIds = unique(
    tickets.map((t) => t.__tenantUserId).filter((id): id is string => Boolean(id)),
  );
  const profiles = await loadProfilesByUserIds(supabase, tenantUserIds);
  const decorated: TicketWithContext[] = tickets.map((t) => {
    const profile = t.__tenantUserId ? profiles.get(t.__tenantUserId) : undefined;
    return {
      ...t.ticket,
      property_name: t.propertyName,
      room_name: t.roomName,
      tenant_name: profile?.full_name ?? null,
      tenant_email: profile?.contact_email ?? t.inviteEmail ?? null,
    };
  });

  decorated.sort(compareTicketsForBoard);

  return {
    tickets: decorated,
    byStatus: groupByStatus(decorated),
    stats: summariseTickets(decorated),
  };
}

/** Tenant-side list — only their own tenancies. */
export async function loadTenantTicketsBoard(tenantUserId: string): Promise<TicketBoardData> {
  const supabase = await createClient();

  const { data: tenancies, error: tErr } = await supabase
    .from('tenancies')
    .select('id')
    .eq('tenant_user_id', tenantUserId);
  if (tErr) throw tErr;

  const tenancyIds = (tenancies ?? []).map((t) => t.id);
  if (tenancyIds.length === 0) {
    return { tickets: [], byStatus: groupByStatus([]), stats: summariseTickets([]) };
  }

  const { data: rows, error } = await supabase
    .from('tickets')
    .select(
      `*,
       properties:property_id (name),
       rooms:room_id (name)`,
    )
    .in('tenancy_id', tenancyIds)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const decorated: TicketWithContext[] = (rows ?? []).map((raw) => {
    const property = pickFirst<{ name: string }>(raw.properties);
    const room = pickFirst<{ name: string }>(raw.rooms);
    return {
      ...Ticket.parse(raw),
      property_name: property?.name ?? null,
      room_name: room?.name ?? null,
      tenant_name: null,
      tenant_email: null,
    };
  });

  decorated.sort(compareTicketsForBoard);

  return {
    tickets: decorated,
    byStatus: groupByStatus(decorated),
    stats: summariseTickets(decorated),
  };
}

export type TicketDetailData = {
  ticket: TicketWithContext;
  messages: TicketMessage[];
  authors: Record<string, { full_name: string | null; contact_email: string | null }>;
};

/**
 * Single-ticket detail — used by both tenant and landlord ticket pages.
 * Returns null if the ticket is not visible to the caller (RLS).
 */
export async function loadTicketPage(ticketId: string): Promise<TicketDetailData | null> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from('tickets')
    .select(
      `*,
       properties:property_id (name),
       rooms:room_id (name),
       tenancies:tenancy_id (tenant_user_id, invite_email)`,
    )
    .eq('id', ticketId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const hydrated = hydrateTicket(row);
  const profiles = await loadProfilesByUserIds(
    supabase,
    hydrated.__tenantUserId ? [hydrated.__tenantUserId] : [],
  );
  const tenantProfile = hydrated.__tenantUserId ? profiles.get(hydrated.__tenantUserId) : undefined;

  const { data: msgRows, error: mErr } = await supabase
    .from('ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (mErr) throw mErr;

  const messages = (msgRows ?? []).map((m) => TicketMessage.parse(m));
  const authorIds = unique(
    messages.map((m) => m.author_user_id).filter((id): id is string => Boolean(id)),
  );
  const authorProfiles = await loadProfilesByUserIds(supabase, authorIds);
  const authors: TicketDetailData['authors'] = {};
  for (const [id, p] of authorProfiles) {
    authors[id] = { full_name: p.full_name, contact_email: p.contact_email };
  }

  return {
    ticket: {
      ...hydrated.ticket,
      property_name: hydrated.propertyName,
      room_name: hydrated.roomName,
      tenant_name: tenantProfile?.full_name ?? null,
      tenant_email: tenantProfile?.contact_email ?? hydrated.inviteEmail ?? null,
    },
    messages,
    authors,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TenancyJoin = z
  .object({
    tenant_user_id: uuid.nullable().optional(),
    invite_email: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

type HydratedTicket = {
  ticket: Ticket;
  propertyName: string | null;
  roomName: string | null;
  inviteEmail: string | null;
  __tenantUserId: string | null;
};

function hydrateTicket(raw: unknown): HydratedTicket {
  const obj = raw as Record<string, unknown>;
  const ticket = Ticket.parse(obj);

  const property = pickFirst<{ name: string }>(obj.properties);
  const room = pickFirst<{ name: string }>(obj.rooms);
  const tenancy = pickFirst<z.infer<typeof TenancyJoin>>(obj.tenancies);

  return {
    ticket,
    propertyName: property?.name ?? null,
    roomName: room?.name ?? null,
    inviteEmail: tenancy?.invite_email ?? null,
    __tenantUserId: tenancy?.tenant_user_id ?? null,
  };
}

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
