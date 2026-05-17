import 'server-only';
import { DOCUMENT_BUCKET } from '@/core/constants/documents';
import { DbError, NotFoundError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';

const SIGN_DOWNLOAD_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Mint a short-lived signed URL for an existing document.
 *
 * Authorisation flow:
 *   1. SELECT the documents row (RLS enforces visibility).
 *   2. If the row is hidden, return 404 — never leak the storage path.
 *   3. Sign the underlying object's storage path.
 *
 * The bucket is private and storage RLS mirrors the table RLS, so even
 * if the path leaked, the signed URL is still scoped to the bucket and
 * tied to the storage RLS predicate at sign time.
 */
export async function signDocumentDownloadUrl(
  ctx: HandlerContext,
  documentId: string,
): Promise<{ url: string; filename: string; expires_in_seconds: number }> {
  requireUser(ctx);

  const { data, error } = await ctx.supabase
    .from('documents')
    .select('storage_path, filename')
    .eq('id', documentId)
    .maybeSingle();
  if (error) throw new DbError(error);
  if (!data) throw new NotFoundError('Document not found');

  const { data: signed, error: signErr } = await ctx.supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(data.storage_path, SIGN_DOWNLOAD_TTL_SECONDS);
  if (signErr || !signed) {
    ctx.log.warn({ err: signErr, documentId, path: data.storage_path }, 'createSignedUrl failed');
    throw new NotFoundError('Document not found');
  }

  return {
    url: signed.signedUrl,
    filename: data.filename,
    expires_in_seconds: SIGN_DOWNLOAD_TTL_SECONDS,
  };
}
