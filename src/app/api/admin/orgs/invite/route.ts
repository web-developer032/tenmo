import { z } from 'zod';
import { slugify } from '@/core/utils/slug';
import { assertAdmin, getAdminSelf } from '@/features/admin/server';
import { sendEmail } from '@/lib/email';
import { renderLandlordInviteEmail } from '@/lib/email/templates/landlord-invite';
import { getServerEnv } from '@/lib/env.server';
import { BusinessRuleError, DbError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Invite a new landlord by emailing them a magic link.
 *
 * For the v1 demo we stop short of actually creating an `orgs` row (the
 * RLS policy requires `created_by = auth.uid()` so the org must be
 * inserted by the recipient on first sign-in). Instead we:
 *   1. Write an `admin_audit_log` row with `event = 'landlord_invited'`
 *      and the suggested name + slug so the audit feed is honest.
 *   2. Send a templated invite email via Resend (or log to console in
 *      dev) so the recipient lands at `/onboarding/create-org` with the
 *      org name + tier pre-filled (via the email link's query params).
 *
 * Allowed roles: super, support.
 */

const Body = z.object({
  org_name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  tier: z.enum(['starter', 'pro', 'portfolio']).default('pro'),
});

export const POST = handler(
  async (ctx) => {
    await assertAdmin(ctx);
    const { req, supabase, user, log } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    if (!['super', 'support'].includes(self.role)) {
      throw new BusinessRuleError('Insufficient role to invite landlords');
    }

    const json = await req.json().catch(() => ({}));
    const input = Body.parse(json);
    const slug = slugify(input.org_name);

    const env = getServerEnv();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.VERCEL_URL ??
      'http://localhost:3000';
    const base = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
    const signupUrl = `${base}/signup?invite=landlord&org=${encodeURIComponent(slug)}&name=${encodeURIComponent(
      input.org_name,
    )}&tier=${encodeURIComponent(input.tier)}&email=${encodeURIComponent(input.email)}`;

    const rendered = renderLandlordInviteEmail({
      recipientEmail: input.email,
      orgName: input.org_name,
      tier: input.tier,
      invitedByName: self.display_name ?? user.email ?? null,
      signupUrl,
    });
    const sendResult = await sendEmail({
      to: input.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [
        { name: 'kind', value: 'landlord_invite' },
        { name: 'tier', value: input.tier },
      ],
    });

    const { error: auditErr } = await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'landlord_invited',
      target_org_id: null,
      payload: {
        email: input.email,
        org_name: input.org_name,
        suggested_slug: slug,
        tier: input.tier,
        provider: sendResult.ok ? sendResult.provider : 'error',
        provider_id: sendResult.ok ? sendResult.id : null,
        configured: Boolean(env.RESEND_API_KEY),
      },
    });
    if (auditErr) {
      log.error({ err: auditErr }, 'admin audit write failed');
      throw new DbError(auditErr);
    }

    log.info(
      {
        recipient: input.email,
        provider: sendResult.ok ? sendResult.provider : 'error',
        tier: input.tier,
      },
      'landlord invite dispatched',
    );

    return Response.json(
      {
        data: {
          email: input.email,
          slug,
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
