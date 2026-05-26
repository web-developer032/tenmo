import 'server-only';
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { BusinessRuleError } from '@/lib/errors';
import { createServiceClient } from '@/lib/supabase/service';
import { IMPERSONATION_SESSION_COOKIE } from './constants';
import { restoreAdminSession } from './cookies';

/**
 * Stop the active impersonation session.
 *
 *   1. Read the impersonation session id from the marker cookie.
 *   2. Stamp `admin_impersonation_sessions.ended_at = now()` via the
 *      service-role client (the active session belongs to the target
 *      user; we don't want RLS to refuse the update).
 *   3. Restore the admin's original Supabase cookies and clear all
 *      backup cookies.
 *
 * Returns the impersonation session id (so the API route can write
 * the matching `impersonation_end` audit row attributed to the admin
 * once they're back in their session).
 */

export type StopImpersonationResult = {
  sessionId: string | null;
  durationSeconds: number | null;
  adminUserId: string | null;
};

export async function stopImpersonation(
  reqCookies: ReadonlyRequestCookies,
  resCookies: ResponseCookies,
): Promise<StopImpersonationResult> {
  const sessionId = reqCookies.get(IMPERSONATION_SESSION_COOKIE)?.value ?? null;
  let adminUserId: string | null = null;
  let durationSeconds: number | null = null;

  if (sessionId) {
    const svc = createServiceClient();
    const { data: row } = await svc
      .from('admin_impersonation_sessions')
      .select('admin_user_id, started_at, ended_at')
      .eq('id', sessionId)
      .maybeSingle();

    if (row && !row.ended_at) {
      adminUserId = (row.admin_user_id as string | null) ?? null;
      const startedMs = new Date(row.started_at as string).getTime();
      durationSeconds = Math.max(0, Math.round((Date.now() - startedMs) / 1000));
      const { error } = await svc
        .from('admin_impersonation_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId);
      if (error) {
        // Non-fatal: cookie restore must still proceed so the admin
        // doesn't get stuck signed in as the target.
        console.warn('Failed to mark impersonation session ended', error);
      }
    }
  }

  const restored = restoreAdminSession(reqCookies, resCookies);
  if (!restored) {
    throw new BusinessRuleError('No impersonation session to stop');
  }

  return { sessionId, durationSeconds, adminUserId };
}
