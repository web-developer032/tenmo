import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { assertAdmin, getAdminSelf } from '@/features/admin/server';
import { BusinessRuleError, ConflictError, DbError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Invite a new admin team member.
 *
 * Allowed roles: super only.
 *
 * Writes an `admin_invites` row with a 7-day expiry. The recipient
 * accepts via the magic-link signup flow; once they sign up an
 * Inngest job (TODO) consumes the invite and inserts the
 * `admin_users` row.
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

    const { data, error } = await supabase
      .from('admin_invites')
      .insert({
        email: input.email,
        role: input.role,
        invited_by: user.id,
        token,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictError(undefined, 'An invite for this email is already pending');
      }
      log.error({ err: error }, 'admin invite insert failed');
      throw new DbError(error);
    }

    await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'admin_invited',
      payload: { email: input.email, role: input.role, invite_id: data.id },
    });

    return Response.json({ data: { id: data.id, email: input.email } }, { status: 201 });
  },
  { requireAuth: true },
);
