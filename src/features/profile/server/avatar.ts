import 'server-only';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { getLogger } from '@/lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Avatar upload helpers — used by `/api/profile/avatar` to give the
 * client a short-lived signed upload URL pointed at the
 * `tenantly-avatars` bucket, plus the final public URL we stash on
 * `profiles.avatar_url`.
 *
 * Storage layout: `<user_id>/<timestamp>-<random>.<ext>`
 *
 * The bucket is public so we never need to mint signed download URLs;
 * the upload is gated by RLS that pins the path prefix to `auth.uid()`.
 */

const BUCKET = 'tenantly-avatars';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type AvatarUploadTicket = {
  upload_url: string;
  /** Storage path used in subsequent `setProfileAvatar` call. */
  path: string;
  /** Public URL we'll persist on `profiles.avatar_url`. */
  public_url: string;
  /** Echo back what we accepted so the client can render an inline preview. */
  content_type: string;
  size_bytes: number;
};

export async function createAvatarUploadTicket(args: {
  supabase: SupabaseClient;
  userId: string;
  contentType: string;
  sizeBytes: number;
}): Promise<AvatarUploadTicket> {
  const log = getLogger().child({ module: 'profile.avatar-upload' });
  if (!ALLOWED_MIME.has(args.contentType)) {
    throw new AppError(
      400,
      ErrorCode.bad_request,
      `Avatar must be image/jpeg, image/png or image/webp (got ${args.contentType})`,
    );
  }
  if (args.sizeBytes <= 0 || args.sizeBytes > MAX_SIZE_BYTES) {
    throw new AppError(
      400,
      ErrorCode.bad_request,
      `Avatar size must be between 1 byte and ${MAX_SIZE_BYTES / 1024 / 1024} MiB`,
    );
  }

  const ext = extFromMime(args.contentType);
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `${args.userId}/${ts}-${rand}.${ext}`;

  const { data, error } = await args.supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    log.error({ err: error }, 'createSignedUploadUrl failed for avatar');
    throw new AppError(
      500,
      ErrorCode.integration_error,
      'Could not initiate avatar upload',
      error ?? undefined,
    );
  }

  const { data: pub } = args.supabase.storage.from(BUCKET).getPublicUrl(path);
  return {
    upload_url: data.signedUrl,
    path,
    public_url: pub.publicUrl,
    content_type: args.contentType,
    size_bytes: args.sizeBytes,
  };
}

/**
 * Persist the uploaded avatar's public URL on `profiles.avatar_url`.
 * Called after the client has finished PUTting bytes to `upload_url`.
 *
 * Optionally cleans up the previous avatar object so the bucket doesn't
 * leak orphans on every change.
 */
export async function setProfileAvatar(args: {
  supabase: SupabaseClient;
  userId: string;
  path: string;
  publicUrl: string;
}): Promise<{ avatar_url: string }> {
  const log = getLogger().child({ module: 'profile.avatar-upload' });

  if (!args.path.startsWith(`${args.userId}/`)) {
    throw new AppError(403, ErrorCode.forbidden, 'Avatar path does not belong to caller');
  }

  const { data: previous } = await args.supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', args.userId)
    .maybeSingle();

  const { error } = await args.supabase
    .from('profiles')
    .update({ avatar_url: args.publicUrl })
    .eq('id', args.userId);
  if (error) throw new DbError(error);

  if (previous?.avatar_url) {
    const previousPath = extractAvatarPath(previous.avatar_url);
    if (previousPath && previousPath !== args.path && previousPath.startsWith(`${args.userId}/`)) {
      const { error: removeErr } = await args.supabase.storage
        .from(BUCKET)
        .remove([previousPath]);
      if (removeErr) {
        log.warn({ err: removeErr, previousPath }, 'previous avatar cleanup failed');
      }
    }
  }

  return { avatar_url: args.publicUrl };
}

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'bin';
}

function extractAvatarPath(publicUrl: string | null | undefined): string | null {
  if (!publicUrl) return null;
  const marker = `/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}
