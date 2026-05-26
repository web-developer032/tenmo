import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { assertAdmin, getAdminSelf } from '@/features/admin/server';
import { sendEmail } from '@/lib/email';
import { renderAdminInviteEmail } from '@/lib/email/templates/admin-invite';
import { getServerEnv } from '@/lib/env.server';
import { BusinessRuleError, ConflictError, DbError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Invite a new admin team member.
 *
 * Allowed roles: super only.
 *
 * Writes an `admin_invites` row with a 7-day expiry and sends a templated
 * invite email containing the accept URL. The recipient accepts via the
 * magic-link signup flow; once they sign up the invite-redemption
 * route (POST /api/admin/team/invites/[id]/accept) consumes the row
 * and inserts the `admin_users` record.
 *
 * Email delivery is best-effort: when Resend isn't configured the email
 * is logged to the console (the audit row is the source of truth) so the
 * smoke tests don't depend on outbound mail.
 */

const Body = z
  .object({
    email: z
      .string()
      .email()
      .transform((s) => s.toLowerCase()),
    role: z.enum(['super', 'support', 'finance', 'readonly']),
  })
  .strict();

export const POST = handler(
  async (ctx) => {
    await assertAdmin(ctx);
    const { req, supabase, user, log } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    if (self.role !== 'super') {
      throw new BusinessRuleError('Only super admins can invite team members');
    }

    const json = await req.json().catch(() => ({}));
    const input = Body.parse(json);
    const token = randomBytes(24).toString('hex');
    const expiresAtIso = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    const { data, error } = await supabase
      .from('admin_invites')
      .insert({
        email: input.email,
        role: input.role,
        invited_by: user.id,
        token,
      })
      .select('id, expires_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictError(undefined, 'An invite for this email is already pending');
      }
      log.error({ err: error }, 'admin invite insert failed');
      throw new DbError(error);
    }

    const env = getServerEnv();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.VERCEL_URL ??
      'http://localhost:3000';
    const base = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
    const acceptUrl = `${base}/signup?invite=admin&token=${encodeURIComponent(token)}&email=${encodeURIComponent(input.email)}`;

    const rendered = renderAdminInviteEmail({
      recipientEmail: input.email,
      role: input.role,
      invitedByName: self.display_name ?? user.email ?? null,
      acceptUrl,
      expiresAt: data.expires_at ?? expiresAtIso,
    });
    const sendResult = await sendEmail({
      to: input.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [
        { name: 'kind', value: 'admin_invite' },
        { name: 'role', value: input.role },
      ],
    });

    await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'admin_invited',
      payload: {
        email: input.email,
        role: input.role,
        invite_id: data.id,
        provider: sendResult.ok ? sendResult.provider : 'error',
        provider_id: sendResult.ok ? sendResult.id : null,
        configured: Boolean(env.RESEND_API_KEY),
      },
    });

    return Response.json(
      {
        data: {
          id: data.id,
          email: input.email,
          delivery: sendResult.ok
            ? { provider: sendResult.provider, id: sendResult.id }
            : { provider: 'error', error: sendResult.error },
        },
      },
      { status: 201 },
    );
  },
  { requireAuth: true },
);
