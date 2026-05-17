import 'server-only';
import { publishNotification } from '@/features/notifications/server';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Notify every owner of an org that the subscription has gone past_due.
 *
 * Triggered from the Stripe webhook handler on `invoice.payment_failed`
 * (and as a guard on the next `customer.subscription.updated` event
 * that downgrades status). Best-effort — failures are logged but never
 * thrown.
 */
const log = () => getLogger().child({ module: 'billing.notify-past-due' });

export async function notifyOrgPastDue(orgId: string): Promise<void> {
  try {
    const sb = createServiceClient();
    const { data: owners, error } = await sb
      .from('org_memberships')
      .select('user_id')
      .eq('org_id', orgId)
      .eq('role', 'owner')
      .is('revoked_at', null);
    if (error) {
      log().warn({ err: error, orgId }, 'owner lookup failed');
      return;
    }

    const { data: org } = await sb.from('orgs').select('name, slug').eq('id', orgId).maybeSingle();
    const link = org ? `/landlord/${org.slug}/billing` : '/';

    for (const o of owners ?? []) {
      await publishNotification({
        user_id: o.user_id,
        kind: 'subscription_past_due',
        title: 'Payment failed',
        body: `Your Tenantly subscription for ${org?.name ?? 'your organisation'} could not be charged. Update your card to keep using paid features.`,
        link_url: link,
        entity_type: 'org_subscription',
        entity_id: orgId,
        meta: { org_id: orgId },
      });
    }
  } catch (err) {
    log().warn({ err, orgId }, 'past-due notify failed');
  }
}
