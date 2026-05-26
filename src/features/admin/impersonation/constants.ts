/**
 * Cookie names used by the impersonation feature. The admin's
 * original auth cookies are saved under these keys before the
 * standard Supabase auth cookies are overwritten with the target
 * user's session.
 *
 * Restoring is just "move BACKUP_* cookies back onto their canonical
 * names and delete the BACKUP_* copies".
 */
export const ORIGINAL_SESSION_COOKIE = 'tenantly-admin-original-session';
export const ORIGINAL_REFRESH_COOKIE = 'tenantly-admin-original-refresh';
export const IMPERSONATION_TARGET_COOKIE = 'tenantly-impersonation-target';
export const IMPERSONATION_SESSION_COOKIE = 'tenantly-impersonation-session';

/** TTL for the backup cookie set (matches Supabase default). */
export const BACKUP_TTL_SECONDS = 60 * 60 * 8; // 8 hours

/** Cookie path so every Tenantly request sees the backup. */
export const COOKIE_PATH = '/';
