import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { publicEnv } from '@/lib/env.public';
import { AppError, BusinessRuleError, ErrorCode } from '@/lib/errors';
import { createServiceClient } from '@/lib/supabase/service';
import { stashAdminSession } from './cookies';

/**
 * Begin impersonating `targetUserId` as the calling admin. Returns
 * the impersonation session row id so the caller can audit + show
 * the banner.
 *
 * Mechanics:
 *   1. Service-role client looks up the target user's email.
 *   2. `auth.admin.generateLink({ type: 'magiclink' })` mints a one-
 *      shot link without sending an email — we just need the
 *      hashed_token.
 *   3. An anon client calls `auth.verifyOtp({ token_hash })`, which
 *      returns the target user's access + refresh tokens.
 *   4. We stash the admin's original Supabase cookies under a
 *      separately-named backup key (`tenantly-admin-original-session`),
 *      then set the target user's session into the canonical cookies
 *      via the SSR helper.
 *   5. A row is written to `admin_impersonation_sessions`.
 *
 * Failure modes:
 *   - admin without super role → BusinessRuleError(role)
 *   - generateLink failure → AppError(503)
 *   - verifyOtp failure (signature drift) → AppError(503)
 *   - everything else surfaces as 500
 */

export type StartImpersonationInput = {
  adminUserId: string;
  targetUserId: string;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
};

export type StartImpersonationResult = {
  sessionId: string;
  target: { id: string; email: string; name: string };
};

export async function startImpersonation(
  reqCookies: ReadonlyRequestCookies,
  resCookies: ResponseCookies,
  input: StartImpersonationInput,
): Promise<StartImpersonationResult> {
  const svc = createServiceClient();

  // Lookup the target's email + display name.
  const { data: targetProfile, error: profileErr } = await svc
    .from('profiles')
    .select('id, contact_email, full_name')
    .eq('id', input.targetUserId)
    .maybeSingle();
  if (profileErr || !targetProfile?.contact_email) {
    throw new AppError(404, ErrorCode.not_found, 'Target user not found');
  }
  const target = {
    id: targetProfile.id as string,
    email: targetProfile.contact_email as string,
    name: (targetProfile.full_name as string | null) ?? (targetProfile.contact_email as string),
  };

  // Mint a magiclink (does NOT email it — we only need the hashed_token).
  const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
    type: 'magiclink',
    email: target.email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new AppError(503, ErrorCode.integration_error, 'Unable to mint impersonation link');
  }

  // Exchange the hashed token for an actual session using an anon client.
  const exchanger = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {
          /* noop — we'll set the cookies ourselves once we've swapped backups */
        },
      },
    },
  );
  const { data: verifyData, error: verifyErr } = await exchanger.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr || !verifyData?.session) {
    throw new AppError(503, ErrorCode.integration_error, 'Unable to exchange impersonation link');
  }
  const session = verifyData.session;

  // Persist the impersonation session row BEFORE swapping cookies so
  // the audit trail is always created against the admin's identity.
  const { data: sessionRow, error: sessionErr } = await svc
    .from('admin_impersonation_sessions')
    .insert({
      admin_user_id: input.adminUserId,
      target_user_id: target.id,
      reason: input.reason,
      ip_address: input.ip,
      user_agent: input.userAgent,
    })
    .select('id')
    .single();
  if (sessionErr || !sessionRow?.id) {
    throw new AppError(500, ErrorCode.db_error, 'Failed to record impersonation session');
  }

  // Backup the admin's auth cookies + write the target's session.
  stashAdminSession(reqCookies, resCookies, {
    targetUserId: target.id,
    targetEmail: target.email,
    targetName: target.name,
    sessionId: sessionRow.id,
  });

  // Push the target's session into the canonical Supabase cookies via SSR.
  const writer = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            resCookies.set({
              name,
              value,
              ...(options ?? {}),
              path: options?.path ?? '/',
            });
          }
        },
      },
    },
  );
  const { error: setSessErr } = await writer.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (setSessErr) {
    throw new AppError(500, ErrorCode.internal_error, 'Unable to persist impersonation session');
  }

  return {
    sessionId: sessionRow.id as string,
    target,
  };
}

/** Convenience guard the route handler can call to bail early. */
export function assertSuperAdmin(role: string | null | undefined): asserts role is 'super' {
  if (role !== 'super') {
    throw new BusinessRuleError('Only super admins can impersonate other users');
  }
}
