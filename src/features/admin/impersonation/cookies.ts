import 'server-only';
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import {
  BACKUP_TTL_SECONDS,
  COOKIE_PATH,
  IMPERSONATION_SESSION_COOKIE,
  IMPERSONATION_TARGET_COOKIE,
  ORIGINAL_REFRESH_COOKIE,
  ORIGINAL_SESSION_COOKIE,
} from './constants';

/**
 * The pieces of an "impersonation context" we surface to the rest of
 * the app via the backup cookies. Reading `tenantly-impersonation-target`
 * is enough to render the sticky banner; the cookies that hold the
 * admin's original session are httpOnly so client code never sees them.
 */
export type SerialisedSupabaseCookies = Array<{
  name: string;
  value: string;
}>;

type CookieStore =
  | ReadonlyRequestCookies
  | { getAll: () => Array<{ name: string; value: string }> };

/**
 * Collect every Supabase auth cookie from the current request. The
 * SSR helper writes its session into one (or sometimes multiple
 * chunked) cookies starting with `sb-`, so we capture the whole set.
 */
export function snapshotSupabaseCookies(store: CookieStore): SerialisedSupabaseCookies {
  const all = (store.getAll as () => Array<{ name: string; value: string }>)();
  return all.filter((c) => c.name.startsWith('sb-')).map((c) => ({ name: c.name, value: c.value }));
}

function setSecureCookie(
  resCookies: ResponseCookies,
  name: string,
  value: string,
  maxAge: number,
  httpOnly: boolean,
): void {
  resCookies.set({
    name,
    value,
    httpOnly,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: COOKIE_PATH,
    maxAge,
  });
}

/**
 * Persist the admin's existing Supabase cookies under our private
 * backup names, then clear the originals so the next request reads as
 * "anonymous" before the impersonation session is written.
 */
export function stashAdminSession(
  requestCookies: CookieStore,
  responseCookies: ResponseCookies,
  meta: { targetUserId: string; targetEmail: string; targetName: string; sessionId: string },
): void {
  const snapshot = snapshotSupabaseCookies(requestCookies);
  const blob = encodeURIComponent(JSON.stringify(snapshot));
  setSecureCookie(responseCookies, ORIGINAL_SESSION_COOKIE, blob, BACKUP_TTL_SECONDS, true);
  setSecureCookie(
    responseCookies,
    ORIGINAL_REFRESH_COOKIE,
    Date.now().toString(),
    BACKUP_TTL_SECONDS,
    true,
  );
  setSecureCookie(
    responseCookies,
    IMPERSONATION_TARGET_COOKIE,
    encodeURIComponent(
      JSON.stringify({
        userId: meta.targetUserId,
        email: meta.targetEmail,
        name: meta.targetName,
      }),
    ),
    BACKUP_TTL_SECONDS,
    false,
  );
  setSecureCookie(
    responseCookies,
    IMPERSONATION_SESSION_COOKIE,
    meta.sessionId,
    BACKUP_TTL_SECONDS,
    true,
  );

  // Wipe the now-stale supabase cookies — `signInWithIdToken` /
  // session write will repopulate them with the target user's tokens.
  for (const c of snapshot) {
    responseCookies.delete({ name: c.name, path: COOKIE_PATH });
  }
}

/**
 * Restore the admin's original Supabase cookies and clear the
 * impersonation markers. Idempotent — calling twice is a no-op.
 */
export function restoreAdminSession(
  requestCookies: CookieStore,
  responseCookies: ResponseCookies,
): boolean {
  const raw = (requestCookies as ReadonlyRequestCookies).get(ORIGINAL_SESSION_COOKIE)?.value;
  if (!raw) return false;

  let snapshot: SerialisedSupabaseCookies = [];
  try {
    snapshot = JSON.parse(decodeURIComponent(raw)) as SerialisedSupabaseCookies;
  } catch {
    snapshot = [];
  }

  // Clear the impersonation's supabase cookies before writing the originals.
  for (const c of snapshotSupabaseCookies(requestCookies)) {
    responseCookies.delete({ name: c.name, path: COOKIE_PATH });
  }
  for (const c of snapshot) {
    responseCookies.set({
      name: c.name,
      value: c.value,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: COOKIE_PATH,
    });
  }
  for (const name of [
    ORIGINAL_SESSION_COOKIE,
    ORIGINAL_REFRESH_COOKIE,
    IMPERSONATION_TARGET_COOKIE,
    IMPERSONATION_SESSION_COOKIE,
  ]) {
    responseCookies.delete({ name, path: COOKIE_PATH });
  }
  return true;
}
