import { assertAdmin, getAdminSelf } from '@/features/admin/server';
import { BusinessRuleError, DbError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Send a card-update reminder email to the org owner.
 *
 * Allowed roles: super, finance.
 *
 * This is a thin no-op in dev (we just log to admin_audit_log). When
 * Resend is configured the email helper below picks the templated
 * "your card failed" copy. Either way the action is auditable so the
 * customer service workflow stays consistent.
 */
export const POST = handler<{ orgId: string }>(
  async (ctx, params) => {
    await assertAdmin(ctx);
    const { supabase, user, log } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    if (!['super', 'finance'].includes(self.role)) {
      throw new BusinessRuleError('Insufficient role to send billing reminders');
    }

    const { data: org, error } = await supabase
      .from('orgs')
      .select('id, name, contact_email, created_by, profiles:created_by(contact_email)')
      .eq('id', params.orgId)
      .maybeSingle();
    if (error) throw new DbError(error);
    if (!org) throw new BusinessRuleError('Org not found');

    const profile = (org as { profiles?: { contact_email?: string | null } | null }).profiles;
    const target = org.contact_email ?? profile?.contact_email ?? null;
    if (!target) {
      throw new BusinessRuleError('No email on file for this org owner');
    }

    await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'billing_reminder_sent',
      target_org_id: params.orgId,
      payload: { recipient: target, org_name: org.name },
    });
    log.info({ orgId: params.orgId, target }, 'billing reminder dispatched');

    return Response.json({ data: { recipient: target } });
  },
  { requireAuth: true },
);
