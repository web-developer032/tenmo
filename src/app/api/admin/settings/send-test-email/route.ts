import { z } from 'zod';
import { assertAdmin, getAdminSelf, getPlatformSettingsWithClient } from '@/features/admin/server';
import { sendEmail } from '@/lib/email/client';
import { BusinessRuleError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * POST /api/admin/settings/send-test-email
 *
 * Sends a small templated email to the address provided in the body
 * (defaults to the caller's profile email). Useful when an admin
 * tweaks Resend config and wants to verify the new From name /
 * address before relying on it in production flows.
 */

const Body = z
  .object({
    to: z.string().email().optional(),
  })
  .strict()
  .optional();

export const POST = handler(
  async (ctx) => {
    await assertAdmin(ctx);
    const { req, supabase, user } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    if (self.role !== 'super') {
      throw new BusinessRuleError('Only super admins can send test emails');
    }

    const json = await req.json().catch(() => undefined);
    const parsed = Body ? Body.parse(json ?? undefined) : undefined;
    const settings = await getPlatformSettingsWithClient(supabase);

    const target = parsed?.to ?? user.email;
    if (!target) {
      throw new BusinessRuleError('No destination address — pass `to` or set a profile email');
    }
    const senderLabel = self.display_name ?? user.email ?? 'an admin';

    const result = await sendEmail({
      to: target,
      subject: 'Tenantly · test email',
      html: `
        <p>Hi from Tenantly admin,</p>
        <p>This is a test message sent by ${senderLabel} at ${new Date().toUTCString()}.</p>
        <p>From: <strong>${settings.email_from_name}</strong> &lt;${settings.email_from_address}&gt;</p>
        <p>If you can read this, Resend (or the console fallback) is working.</p>
      `,
      text: [
        'Tenantly test email.',
        `Sent by ${senderLabel} at ${new Date().toUTCString()}.`,
        `From: ${settings.email_from_name} <${settings.email_from_address}>.`,
        'If you can read this, Resend (or the console fallback) is working.',
      ].join('\n'),
      tags: [{ name: 'kind', value: 'admin-test-email' }],
    });

    if (!result.ok) {
      throw new BusinessRuleError(result.error);
    }

    await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'platform_settings_updated',
      payload: { test_email_sent_to: target, provider: result.provider },
    });

    return Response.json({ data: { ok: true, provider: result.provider, to: target } });
  },
  { requireAuth: true },
);
