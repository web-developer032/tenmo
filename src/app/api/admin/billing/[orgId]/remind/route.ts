import { z } from 'zod';
import { assertAdmin, getAdminSelf } from '@/features/admin/server';
import { sendEmail } from '@/lib/email';
import { renderBillingReminderEmail } from '@/lib/email/templates/billing-reminder';
import { getServerEnv } from '@/lib/env.server';
import { BusinessRuleError, DbError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Send a card-update reminder email to the org owner.
 *
 * Allowed roles: super, finance.
 *
 * Always:
 *   1. Looks up the org + best contact email (`orgs.contact_email`,
 *      falling back to the owner profile's `contact_email`).
 *   2. Records the action in `admin_audit_log`.
 *
 * If Resend is configured (`RESEND_API_KEY`) the email is sent immediately;
 * otherwise the client logs the templated message to the console so the
 * flow stays demoable in dev.
 *
 * Body (optional):
 *   - `reason` — picks which copy variant to use (defaults to `card_failed`
 *     for past-due rows / `manual` for trial rows).
 */

const Body = z
  .object({
    reason: z
      .enum(['card_failed', 'card_declined', 'trial_ending', 'past_due', 'manual'])
      .optional(),
  })
  .strict()
  .optional();

export const POST = handler<{ orgId: string }>(
  async (ctx, params) => {
    await assertAdmin(ctx);
    const { req, supabase, user, log } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    if (!['super', 'finance'].includes(self.role)) {
      throw new BusinessRuleError('Insufficient role to send billing reminders');
    }

    // Body is optional — accept either an empty POST or an explicit reason.
    let parsed: z.infer<typeof Body> = undefined;
    try {
      const json = await req.json();
      parsed = Body.parse(json);
    } catch {
      // No body / invalid body → fall through with parsed = undefined.
    }

    const { data: org, error } = await supabase
      .from('orgs')
      .select('id, name, contact_email, created_by')
      .eq('id', params.orgId)
      .maybeSingle();
    if (error) throw new DbError(error);
    if (!org) throw new BusinessRuleError('Org not found');

    // orgs.created_by FKs auth.users.id, not profiles.id — fetch separately.
    let ownerEmail: string | null = null;
    let ownerName: string | null = null;
    if (org.created_by) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('contact_email, full_name')
        .eq('id', org.created_by)
        .maybeSingle();
      ownerEmail = profile?.contact_email ?? null;
      ownerName = profile?.full_name ?? null;
    }
    const recipient = org.contact_email ?? ownerEmail ?? null;
    if (!recipient) {
      throw new BusinessRuleError('No email on file for this org owner');
    }

    // Subscription context (card last4 + outstanding amount drive copy).
    const { data: sub } = await supabase
      .from('org_subscriptions')
      .select(
        'status, payment_method_last4, mrr_pence, currency, last_payment_status',
      )
      .eq('org_id', params.orgId)
      .maybeSingle();
    const inferredReason =
      sub?.status === 'past_due'
        ? 'past_due'
        : sub?.last_payment_status === 'failed'
          ? 'card_failed'
          : sub?.status === 'trialing'
            ? 'trial_ending'
            : 'manual';
    const reason = parsed?.reason ?? inferredReason;

    const outstandingAmount =
      sub?.mrr_pence && sub.mrr_pence > 0
        ? new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: sub.currency ?? 'GBP',
          }).format(sub.mrr_pence / 100)
        : null;

    const env = getServerEnv();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.VERCEL_URL ??
      'http://localhost:3000';
    const billingUrl = `${siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`}/landlord/billing`;

    const rendered = renderBillingReminderEmail({
      recipientEmail: recipient,
      ownerName,
      orgName: org.name,
      cardLast4: sub?.payment_method_last4 ?? null,
      outstandingAmount,
      reason,
      billingUrl,
    });

    const sendResult = await sendEmail({
      to: recipient,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [
        { name: 'kind', value: 'billing_reminder' },
        { name: 'reason', value: reason },
        { name: 'org_id', value: params.orgId },
      ],
    });

    await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'billing_reminder_sent',
      target_org_id: params.orgId,
      payload: {
        recipient,
        org_name: org.name,
        reason,
        provider: sendResult.ok ? sendResult.provider : 'error',
        provider_id: sendResult.ok ? sendResult.id : null,
        configured: Boolean(env.RESEND_API_KEY),
      },
    });
    log.info(
      {
        orgId: params.orgId,
        recipient,
        reason,
        provider: sendResult.ok ? sendResult.provider : 'error',
      },
      'billing reminder dispatched',
    );

    return Response.json({
      data: {
        recipient,
        reason,
        delivery: sendResult.ok
          ? { provider: sendResult.provider, id: sendResult.id }
          : { provider: 'error', error: sendResult.error },
      },
    });
  },
  { requireAuth: true },
);
