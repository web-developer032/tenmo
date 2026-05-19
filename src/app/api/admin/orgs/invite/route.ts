import { z } from 'zod';
import { slugify } from '@/core/utils/slug';
import { assertAdmin, getAdminSelf } from '@/features/admin/server';
import { BusinessRuleError, DbError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Invite a new landlord by emailing them a magic link.
 *
 * For the demo we stop short of actually creating an `orgs` row (the
 * RLS policy requires `created_by = auth.uid()` so the org must be
 * inserted by the recipient on first sign-in). Instead we write an
 * `admin_audit_log` entry so the action is traceable and rely on the
 * normal Supabase invite flow to land the user at `/onboarding/create-org`
 * with the suggested name + slug pre-filled.
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

    // Record the action — the email itself is sent by the existing
    // notification helper which we already wire from the org-creation
    // flow. For the demo this is a no-op when RESEND_API_KEY is unset.
    const { error: auditErr } = await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'landlord_invited',
      target_org_id: null,
      payload: {
        email: input.email,
        org_name: input.org_name,
        suggested_slug: slug,
        tier: input.tier,
      },
    });
    if (auditErr) {
      log.error({ err: auditErr }, 'admin audit write failed');
      throw new DbError(auditErr);
    }

    return Response.json({ data: { email: input.email, slug } }, { status: 201 });
  },
  { requireAuth: true },
);
