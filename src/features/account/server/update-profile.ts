import 'server-only';
import type { ProfileEditInput } from '@/core/schemas/profile';
import { DbError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';
import { type CurrentProfile, loadCurrentProfile } from '../loaders';

/**
 * Server-only profile updater used by `PATCH /api/profile`.
 *
 * The form schema (`ProfileEditInput`) already validates the shape; this
 * module:
 *   1. Coerces blank-string fields to `null` so the DB stores nullables
 *      cleanly rather than empty strings (RLS doesn't care, but `KV`
 *      treats `''` as "not set" already; nullables keep the DB tidy).
 *   2. Skips the UPDATE when the patch is a no-op so we don't bump
 *      `updated_at` for nothing.
 *   3. Reloads the row through the same `loadCurrentProfile` shape used
 *      by the page — single source of truth for "what the form sees".
 *
 * RLS policy `profiles_update_self` (init.sql) restricts the update to the
 * caller's own row and freezes `flag_abuse_review`, so we don't need
 * defensive filtering beyond passing the request-bound supabase client.
 */
export async function updateOwnProfile(
  ctx: HandlerContext,
  patch: ProfileEditInput,
): Promise<CurrentProfile> {
  if (!ctx.user) {
    throw new DbError('No authenticated user on update-profile call');
  }

  const dbPatch = toDbPatch(patch);
  if (Object.keys(dbPatch).length > 0) {
    const { error } = await ctx.supabase
      .from('profiles')
      .update(dbPatch)
      .eq('id', ctx.user.id)
      .select('id')
      .single();
    if (error) {
      ctx.log.error({ err: error }, 'profile update failed');
      throw new DbError(error);
    }
  }

  const next = await loadCurrentProfile();
  if (!next) {
    throw new DbError('Profile vanished after update — RLS misconfiguration?');
  }
  return next;
}

/**
 * Map the form input to the columns we touch on `public.profiles`. We
 * convert `undefined` -> "leave alone" (skip) and explicit `null` -> NULL.
 * The form's `optionalString` helper is what turns `""` into `undefined`,
 * so an "I cleared the field" gesture from the UI lands here as the field
 * being absent. To wipe a value from the UI we'd need a dedicated UX (a
 * trash icon) — for MVP we just don't expose that path.
 */
function toDbPatch(patch: ProfileEditInput): Record<string, string | boolean | null> {
  const out: Record<string, string | boolean | null> = {};
  if (patch.full_name !== undefined) out.full_name = patch.full_name ?? null;
  if (patch.preferred_name !== undefined) out.preferred_name = patch.preferred_name ?? null;
  if (patch.contact_email !== undefined) out.contact_email = patch.contact_email ?? null;
  if (patch.contact_phone !== undefined) out.contact_phone = patch.contact_phone ?? null;
  if (patch.locale !== undefined) out.locale = patch.locale;
  if (patch.timezone !== undefined) out.timezone = patch.timezone;
  if (patch.theme !== undefined) out.theme = patch.theme;
  if (patch.marketing_opt_in !== undefined) out.marketing_opt_in = patch.marketing_opt_in;
  return out;
}
