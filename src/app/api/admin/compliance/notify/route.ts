import { z } from 'zod';
import { assertAdmin, getAdminSelf } from '@/features/admin/server';
import { sendEmail } from '@/lib/email';
import { renderComplianceAlertEmail } from '@/lib/email/templates/compliance-alert';
import { getServerEnv } from '@/lib/env.server';
import { BusinessRuleError, DbError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Notify a landlord about a compliance violation.
 *
 * Allowed roles: super, support.
 *
 * Always:
 *   1. Resolves the org owner email (orgs.contact_email → owner profile).
 *   2. Records the action in `admin_audit_log`.
 *
 * If Resend is configured the templated compliance alert email is sent;
 * otherwise the message is logged via the console transport. The audit
 * row is always written so the customer-success trail is consistent.
 */

const Body = z
  .object({
    org_id: z.guid(),
    violation_id: z.string().min(1),
    kind: z.string().min(1),
    note: z.string().min(2).max(500).optional(),
  })
  .strict();

export const POST = handler(
  async (ctx) => {
    await assertAdmin(ctx);
    const { req, supabase, user, log } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    if (!['super', 'support'].includes(self.role)) {
      throw new BusinessRuleError('Insufficient role to send compliance alerts');
    }

    const json = await req.json().catch(() => ({}));
    const input = Body.parse(json);

    const { data: org, error } = await supabase
      .from('orgs')
      .select('id, name, slug, contact_email, created_by')
      .eq('id', input.org_id)
      .maybeSingle();
    if (error) throw new DbError(error);
    if (!org) throw new BusinessRuleError('Org not found');

    // Fetch the owner profile separately — orgs.created_by FKs auth.users.id,
    // not profiles.id, so PostgREST can't resolve `profiles:created_by(...)`
    // as a single-step embed without an explicit hint.
    let ownerEmail: string | null = null;
    if (org.created_by) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('contact_email')
        .eq('id', org.created_by)
        .maybeSingle();
      ownerEmail = profile?.contact_email ?? null;
    }

    const recipient = org.contact_email ?? ownerEmail ?? null;
    if (!recipient) {
      throw new BusinessRuleError('No email on file for this org owner');
    }

    const env = getServerEnv();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.VERCEL_URL ??
      'http://localhost:3000';
    const base = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
    const complianceUrl = `${base}/landlord/${encodeURIComponent(org.slug ?? '')}/compliance`;

    const rendered = renderComplianceAlertEmail({
      recipientEmail: recipient,
      orgName: org.name,
      kind: input.kind,
      note: input.note ?? null,
      complianceUrl,
      contactedByName: self.display_name ?? user.email ?? null,
    });
    const sendResult = await sendEmail({
      to: recipient,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [
        { name: 'kind', value: 'compliance_alert' },
        { name: 'violation', value: input.kind },
      ],
    });

    await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'compliance_alert_sent',
      target_org_id: input.org_id,
      payload: {
        violation_id: input.violation_id,
        kind: input.kind,
        recipient,
        note: input.note ?? null,
        provider: sendResult.ok ? sendResult.provider : 'error',
        provider_id: sendResult.ok ? sendResult.id : null,
        configured: Boolean(env.RESEND_API_KEY),
      },
    });
    log.info(
      {
        orgId: input.org_id,
        recipient,
        provider: sendResult.ok ? sendResult.provider : 'error',
      },
      'compliance alert dispatched',
    );

    return Response.json({
      data: {
        recipient,
        delivery: sendResult.ok
          ? { provider: sendResult.provider, id: sendResult.id }
          : { provider: 'error', error: sendResult.error },
      },
    });
  },
  { requireAuth: true },
);
