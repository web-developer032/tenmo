import { z } from 'zod';
import {
  createAvatarUploadTicket,
  setProfileAvatar,
} from '@/features/profile/server';
import { AppError, ErrorCode } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * Profile avatar endpoints.
 *
 * POST /api/profile/avatar   — request a signed upload URL for a new avatar.
 *   Body: { content_type: 'image/jpeg' | 'image/png' | 'image/webp',
 *           size_bytes: <int> }
 *   Response: { upload_url, path, public_url, content_type, size_bytes }
 *
 * PUT  /api/profile/avatar   — persist the uploaded file on the caller's
 *   `profiles.avatar_url`. Body: { path: <string>, public_url: <string> }.
 *   Validates that `path` is under `<user_id>/` so a malicious client
 *   can't point their avatar at someone else's uploaded image.
 *
 * DELETE /api/profile/avatar — clear the caller's avatar.
 */

const UploadBody = z.object({
  content_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size_bytes: z.number().int().positive(),
});

const PersistBody = z.object({
  path: z.string().min(1),
  public_url: z.string().url(),
});

export const POST = handler(
  async (ctx) => {
    if (!ctx.user) {
      throw new AppError(401, ErrorCode.unauthorized, 'Sign in required');
    }
    const body = UploadBody.parse(await ctx.req.json().catch(() => ({})));
    const ticket = await createAvatarUploadTicket({
      supabase: ctx.supabase,
      userId: ctx.user.id,
      contentType: body.content_type,
      sizeBytes: body.size_bytes,
    });
    return Response.json({ data: ticket }, { status: 201 });
  },
  { requireAuth: true },
);

export const PUT = handler(
  async (ctx) => {
    if (!ctx.user) {
      throw new AppError(401, ErrorCode.unauthorized, 'Sign in required');
    }
    const body = PersistBody.parse(await ctx.req.json().catch(() => ({})));
    const result = await setProfileAvatar({
      supabase: ctx.supabase,
      userId: ctx.user.id,
      path: body.path,
      publicUrl: body.public_url,
    });
    return Response.json({ data: result });
  },
  { requireAuth: true },
);

export const DELETE = handler(
  async (ctx) => {
    if (!ctx.user) {
      throw new AppError(401, ErrorCode.unauthorized, 'Sign in required');
    }
    const { error } = await ctx.supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', ctx.user.id);
    if (error) {
      throw new AppError(500, ErrorCode.db_error, 'Could not clear avatar');
    }
    return Response.json({ data: { avatar_url: null } });
  },
  { requireAuth: true },
);
