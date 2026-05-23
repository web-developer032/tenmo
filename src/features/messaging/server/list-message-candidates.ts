import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Who can I start a direct conversation with?" lookup.
 *
 * Used by the inbox `NewConversationDialog`. Returns every person the
 * caller could legitimately address inside a given landlord org:
 *
 *   - org members (other than themselves) — owners, agents, staff;
 *   - current tenants of the org — anyone with a non-cancelled tenancy.
 *
 * Both branches are scoped by RLS, so this loader is a thin
 * orchestrator that hydrates display names + emails from `profiles`
 * after the join completes (we can't single-step embed because
 * `org_memberships.user_id` and `tenancies.tenant_user_id` both FK
 * `auth.users.id`, not `profiles.id`).
 */

export type MessageCandidateKind = "member" | "tenant";

export interface MessageCandidate {
  user_id: string;
  full_name: string | null;
  contact_email: string | null;
  kind: MessageCandidateKind;
  /** Role label (`owner`, `agent`, ...) for members, tenancy status for tenants. */
  detail: string | null;
}

const ACTIVE_TENANCY_STATUSES = [
  "pending_invite",
  "awaiting_signature",
  "awaiting_deposit",
  "active",
];

export async function listMessageCandidates(
  supabase: SupabaseClient,
  options: { orgId: string; excludeUserId: string }
): Promise<MessageCandidate[]> {
  const [membersRes, tenanciesRes] = await Promise.all([
    supabase
      .from("org_memberships")
      .select("user_id, role")
      .eq("org_id", options.orgId)
      .is("revoked_at", null)
      .neq("user_id", options.excludeUserId),
    supabase
      .from("tenancies")
      .select("tenant_user_id, status")
      .eq("org_id", options.orgId)
      .not("tenant_user_id", "is", null)
      .in("status", ACTIVE_TENANCY_STATUSES)
      .neq("tenant_user_id", options.excludeUserId),
  ]);

  if (membersRes.error) throw membersRes.error;
  if (tenanciesRes.error) throw tenanciesRes.error;

  const byId = new Map<string, MessageCandidate>();
  for (const row of (membersRes.data ?? []) as Array<{
    user_id: string;
    role: string;
  }>) {
    byId.set(row.user_id, {
      user_id: row.user_id,
      full_name: null,
      contact_email: null,
      kind: "member",
      detail: row.role,
    });
  }
  for (const row of (tenanciesRes.data ?? []) as Array<{
    tenant_user_id: string;
    status: string;
  }>) {
    if (byId.has(row.tenant_user_id)) continue;
    byId.set(row.tenant_user_id, {
      user_id: row.tenant_user_id,
      full_name: null,
      contact_email: null,
      kind: "tenant",
      detail: row.status,
    });
  }

  const userIds = Array.from(byId.keys());
  if (userIds.length === 0) return [];

  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, contact_email")
    .in("id", userIds);
  if (profErr) throw profErr;

  for (const p of (profiles ?? []) as Array<{
    id: string;
    full_name: string | null;
    contact_email: string | null;
  }>) {
    const c = byId.get(p.id);
    if (!c) continue;
    c.full_name = p.full_name;
    c.contact_email = p.contact_email;
  }

  return Array.from(byId.values()).sort((a, b) => {
    const an = (a.full_name ?? a.contact_email ?? "").toLowerCase();
    const bn = (b.full_name ?? b.contact_email ?? "").toLowerCase();
    return an.localeCompare(bn);
  });
}
