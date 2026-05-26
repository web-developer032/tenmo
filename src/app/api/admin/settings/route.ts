import { z } from 'zod';
import { assertAdmin, getAdminSelf } from '@/features/admin/server';
import { BusinessRuleError, DbError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Update the singleton `platform_settings` row.
 *
 * Allowed roles: super only (enforced both here and by RLS).
 *
 * Every saved field is optional in the request body — the handler
 * patches whatever the client supplied. Audit entry is written
 * regardless of how many fields changed.
 */

const Body = z
  .object({
    starter_plan_pence: z.number().int().min(0).optional(),
    pro_plan_pence: z.number().int().min(0).optional(),
    growth_plan_pence: z.number().int().min(0).optional(),
    trial_days: z.number().int().min(0).max(90).optional(),
    starter_property_limit: z.number().int().min(1).optional(),
    pro_property_limit: z.number().int().min(1).optional(),
    email_from_name: z.string().min(1).max(120).optional(),
    email_from_address: z.string().email().optional(),
    support_email: z.string().email().optional(),
    compliance_alert_gas_days: z.number().int().min(0).max(365).optional(),
    compliance_alert_eicr_days: z.number().int().min(0).max(365).optional(),
    compliance_alert_hmo_days: z.number().int().min(0).max(365).optional(),
    compliance_alert_epc_days: z.number().int().min(0).max(365).optional(),
    compliance_alert_r2r_days: z.number().int().min(0).max(365).optional(),
    compliance_alert_deposit_days: z.number().int().min(0).max(365).optional(),
    assumed_cac_pence: z.number().int().min(0).max(1_000_000).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

export const POST = handler(
  async (ctx) => {
    await assertAdmin(ctx);
    const { req, supabase, user } = ctx;
    if (!user) throw new BusinessRuleError('Sign in required');
    const self = await getAdminSelf(supabase, user.id);
    if (self.role !== 'super') {
      throw new BusinessRuleError('Only super admins can edit platform settings');
    }

    const json = await req.json().catch(() => ({}));
    const input = Body.parse(json);

    const { error } = await supabase
      .from('platform_settings')
      .update({ ...input, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', true);
    if (error) throw new DbError(error);

    await supabase.from('admin_audit_log').insert({
      actor_user_id: user.id,
      event: 'platform_settings_updated',
      payload: { changed: Object.keys(input) },
    });

    return Response.json({ data: { updated: Object.keys(input) } });
  },
  { requireAuth: true },
);
