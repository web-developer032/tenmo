import { z } from 'zod';
import { assertAdmin, getAdminSelf } from '@/features/admin/server';
import { BusinessRuleError, DbError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Notify a landlord about a compliance violation.
 *
 * Allowed roles: super, support.
 *
 * Records the action in `admin_audit_log` so the customer success
 * trail stays auditable even when SMTP isn't wired. When the email
 * helper is configured the actual send is fire-and-forget.
 */

// Use the looser GUID validator (zod 4 `z.guid()`) — the project's seeded
// UUIDs are not strict RFC-4122 v4 (no '4' in the version nibble), and we
// pass them through cookies, route params, and bodies interchangeably.
// See frontend/src/core/schemas/common.ts (`export const uuid = z.guid()`).
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
      .select('id, name, contact_email, created_by')
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

    await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'compliance_alert_sent',
      target_org_id: input.org_id,
      payload: {
        violation_id: input.violation_id,
        kind: input.kind,
        recipient,
        note: input.note ?? null,
      },
    });
    log.info({ orgId: input.org_id, recipient }, 'compliance alert dispatched');

    return Response.json({ data: { recipient } });
  },
  { requireAuth: true },
);
