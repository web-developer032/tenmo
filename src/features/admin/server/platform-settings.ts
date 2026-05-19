import type { SupabaseClient } from '@supabase/supabase-js';
import { DbError } from '@/lib/errors';

/**
 * Read the singleton `platform_settings` row. Inserted by the
 * 20260520000000_admin_platform migration so this should always
 * return data; the fallback exists for defensive coding only.
 */

export type PlatformSettings = {
  starter_plan_pence: number;
  pro_plan_pence: number;
  growth_plan_pence: number;
  trial_days: number;
  starter_property_limit: number;
  pro_property_limit: number;
  email_from_name: string;
  email_from_address: string;
  support_email: string;
  compliance_alert_gas_days: number;
  compliance_alert_eicr_days: number;
  compliance_alert_hmo_days: number;
  compliance_alert_epc_days: number;
  compliance_alert_r2r_days: number;
  compliance_alert_deposit_days: number;
  updated_at: string;
  updated_by: string | null;
};

const DEFAULTS: PlatformSettings = {
  starter_plan_pence: 900,
  pro_plan_pence: 2900,
  growth_plan_pence: 5900,
  trial_days: 14,
  starter_property_limit: 3,
  pro_property_limit: 20,
  email_from_name: 'Tenantly',
  email_from_address: 'hello@tenantly.app',
  support_email: 'support@tenantly.app',
  compliance_alert_gas_days: 30,
  compliance_alert_eicr_days: 60,
  compliance_alert_hmo_days: 90,
  compliance_alert_epc_days: 60,
  compliance_alert_r2r_days: 60,
  compliance_alert_deposit_days: 30,
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

export async function getPlatformSettingsWithClient(sb: SupabaseClient): Promise<PlatformSettings> {
  const { data, error } = await sb
    .from('platform_settings')
    .select('*')
    .eq('id', true)
    .maybeSingle();
  if (error) throw new DbError(error);
  if (!data) return DEFAULTS;
  return { ...DEFAULTS, ...(data as Partial<PlatformSettings>) };
}
