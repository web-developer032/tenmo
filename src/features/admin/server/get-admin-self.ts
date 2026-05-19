import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, ErrorCode, NotFoundError } from '@/lib/errors';

/**
 * Permission tiers we recognise for platform staff. Default for legacy
 * rows is `'super'` (set by the 20260520000000_admin_platform migration).
 */
export type AdminRole = 'super' | 'support' | 'finance' | 'readonly';

export type AdminSelf = {
  user_id: string;
  role: AdminRole;
  display_name: string | null;
  status: 'active' | 'disabled';
  two_factor_enabled: boolean;
  last_active_at: string | null;
};

/**
 * Loads the calling user's `admin_users` row. Used by:
 *   - The /admin layout to gate the whole route (404 if no row).
 *   - Page-level role checks for Finance / Settings / etc.
 *
 * Throws NotFoundError if there's no row (matches the existing
 * `assertAdmin` behaviour — admins should not be discoverable).
 */
export async function getAdminSelf(sb: SupabaseClient, userId: string): Promise<AdminSelf> {
  const { data, error } = await sb
    .from('admin_users')
    .select('user_id, role, display_name, status, two_factor_enabled, last_active_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw new AppError(500, ErrorCode.db_error, 'Admin lookup failed');
  }
  if (!data) throw new NotFoundError();
  return {
    user_id: data.user_id,
    role: (data.role ?? 'super') as AdminRole,
    display_name: data.display_name ?? null,
    status: (data.status ?? 'active') as AdminSelf['status'],
    two_factor_enabled: Boolean(data.two_factor_enabled),
    last_active_at: data.last_active_at ?? null,
  };
}

/**
 * Throws `NotFoundError` (matching `assertAdmin`'s 404-on-no-row policy)
 * when the caller's role isn't in the allowed set. Use to gate role-
 * sensitive UI and API actions.
 */
export function assertAdminRole(self: AdminSelf, allowed: AdminRole[]): void {
  if (self.status !== 'active') throw new NotFoundError();
  if (!allowed.includes(self.role)) throw new NotFoundError();
}

/**
 * Soft check — used in UI when we want to render a disabled control
 * rather than 404 the whole page.
 */
export function hasAdminRole(self: AdminSelf | null, allowed: AdminRole[]): boolean {
  if (!self || self.status !== 'active') return false;
  return allowed.includes(self.role);
}
