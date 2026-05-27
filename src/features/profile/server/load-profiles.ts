import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Batched lookup of `public.profiles` rows by primary key (= auth.users.id).
 *
 * The whole reason this helper exists is that almost every "user-shaped"
 * column in the schema FKs into `auth.users(id)`, not directly into
 * `public.profiles(id)`. PostgREST's auto-embed (`profiles:user_id(...)`,
 * `profiles:tenant_user_id(...)`, `profiles:created_by(...)`, etc.) can't
 * traverse the `tenancies → auth.users ← profiles` triangle and returns
 * PGRST200 ("Could not find a relationship between 'X' and 'user_id' in
 * the schema cache").
 *
 * The fix is the same everywhere: fetch the parent rows first, collect
 * their user-id columns into a set, then look up profiles by primary key
 * and stitch them together in app code. This module is that lookup.
 *
 * Consumers stitch the returned `Map` into their own row shape — we keep
 * this helper minimal on purpose so it doesn't grow a long argument list
 * one new caller at a time.
 *
 * RLS note: `profiles` is readable by any authenticated user, so this
 * helper is safe to call from any server context that already has an
 * authenticated Supabase client. Failures from PostgREST are returned as
 * an empty map (best-effort) rather than thrown — every UI that uses
 * this already falls back to an invite email or a generic label when the
 * profile row is missing.
 */

export type LoadedProfile = {
  full_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export async function loadProfilesByUserIds(
  supabase: SupabaseClient,
  userIds: readonly (string | null | undefined)[],
): Promise<Map<string, LoadedProfile>> {
  const map = new Map<string, LoadedProfile>();
  const ids = uniqueDefined(userIds);
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, contact_email, contact_phone')
    .in('id', ids);
  if (error) return map;

  for (const row of data ?? []) {
    map.set(row.id as string, {
      full_name: (row.full_name as string | null) ?? null,
      contact_email: (row.contact_email as string | null) ?? null,
      contact_phone: (row.contact_phone as string | null) ?? null,
    });
  }
  return map;
}

function uniqueDefined(values: readonly (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (typeof v === 'string' && v.length > 0) set.add(v);
  }
  return Array.from(set);
}
