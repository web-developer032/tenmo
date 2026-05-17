import { ProfileEditInput } from '@/core/schemas/profile';
import { loadCurrentProfile } from '@/features/account/loaders';
import { updateOwnProfile } from '@/features/account/server/update-profile';
import { NotFoundError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * `/api/profile` — read + update the caller's own profile row.
 *
 * Sign-in email is intentionally not editable here: changing the auth
 * email triggers a verification flow and lives behind a separate
 * Supabase auth call. Everything else (display name, contact channels,
 * locale, timezone, theme, marketing opt-in) is fair game.
 */

export const GET = handler(
  async () => {
    const profile = await loadCurrentProfile();
    if (!profile) throw new NotFoundError('Profile not found');
    return Response.json({ data: profile });
  },
  { requireAuth: true },
);

export const PATCH = handler(
  async (ctx) => {
    const json = await ctx.req.json().catch(() => ({}));
    const patch = ProfileEditInput.parse(json);
    const profile = await updateOwnProfile(ctx, patch);
    return Response.json({ data: profile });
  },
  { requireAuth: true },
);
