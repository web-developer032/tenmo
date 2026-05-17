import 'server-only';
import { OrgSubscription, type OrgUsage } from '@/core/schemas/billing';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Server loaders for billing — used by the landlord layout (past-due
 * banner) and the /billing page (current sub + usage). Mirrors
 * `features/notifications/loaders.ts`.
 */

export type BillingFeed = {
  subscription: OrgSubscription | null;
  usage: OrgUsage;
};

export async function loadOrgSubscription(orgId: string): Promise<OrgSubscription | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('org_subscriptions')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error || !data) return null;
  return OrgSubscription.parse(data);
}

export async function loadBillingFeed(orgId: string): Promise<BillingFeed> {
  const sb = createServiceClient();
  const [{ data: subRow }, propertiesRes, roomsRes, tenanciesRes, membersRes] = await Promise.all([
    sb.from('org_subscriptions').select('*').eq('org_id', orgId).maybeSingle(),
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

  const subscription = subRow ? OrgSubscription.parse(subRow) : null;
  const usage: OrgUsage = {
    properties: propertiesRes.count ?? 0,
    rooms: roomsRes.count ?? 0,
    tenancies: tenanciesRes.count ?? 0,
    org_members: membersRes.count ?? 0,
  };
  return { subscription, usage };
}
