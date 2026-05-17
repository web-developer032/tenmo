import 'server-only';
import type { OrgUsage } from '@/core/schemas/billing';
import { DbError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Compute live resource counts for an org. Used by the billing page
 * (usage bars) and by the tier-enforcement helper (`assertTierAllows`).
 *
 * We use the service client so the caller's RLS doesn't surprise us
 * — usage counts are server-authoritative facts about the org and the
 * tier-enforcement decision must not depend on what the caller can
 * see (an agent looking at a property they can't read shouldn't allow
 * a property creation that overshoots the cap).
 *
 * Active tenancies = anything not in 'ended' / 'cancelled' (those
 * historical rows shouldn't count against caps).
 */
export async function getOrgUsage(orgId: string): Promise<OrgUsage> {
  const sb = createServiceClient();

  const [propertiesRes, roomsRes, tenanciesRes, membersRes] = await Promise.all([
    sb
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('archived_at', null),
    sb
      .from('rooms')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('archived_at', null),
    sb
      .from('tenancies')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .not('status', 'in', '(ended,cancelled)'),
    sb
      .from('org_memberships')
      .select('user_id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('revoked_at', null),
  ]);

  for (const res of [propertiesRes, roomsRes, tenanciesRes, membersRes]) {
    if (res.error) throw new DbError(res.error);
  }

  return {
    properties: propertiesRes.count ?? 0,
    rooms: roomsRes.count ?? 0,
    tenancies: tenanciesRes.count ?? 0,
    org_members: membersRes.count ?? 0,
  };
}

/** Convenience wrapper that asserts the caller is signed in (used by
 * the billing page loader). */
export async function getOrgUsageForCaller(ctx: HandlerContext, orgId: string): Promise<OrgUsage> {
  requireUser(ctx);
  return getOrgUsage(orgId);
}
