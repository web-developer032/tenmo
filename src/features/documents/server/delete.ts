import 'server-only';
import { DOCUMENT_BUCKET } from '@/core/constants/documents';
import { DbError, NotFoundError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';

/**
 * Delete a document — both the row and the underlying storage object.
 *
 * Authorisation: the table-level RLS policy (`documents_delete_owners`)
 * already restricts deletion to org owners; we just call the delete and
 * report a clean 404 if the row doesn't exist or RLS hides it.
 *
 * On success we also remove the storage object. Storage RLS mirrors the
 * row policy, so a caller who could delete the row can also delete the
 * object. Failures to remove the object after the row is gone are logged
 * and tolerated — an orphan blob in the bucket is a reaper job concern,
 * not a user-facing failure.
 */
export async function deleteDocument(ctx: HandlerContext, documentId: string): Promise<void> {
  requireUser(ctx);

  const { data: existing, error: lookupErr } = await ctx.supabase
    .from('documents')
    .select('id, storage_path')
    .eq('id', documentId)
    .maybeSingle();
  if (lookupErr) throw new DbError(lookupErr);
  if (!existing) throw new NotFoundError('Document not found');

  const { error: delErr } = await ctx.supabase.from('documents').delete().eq('id', documentId);
  if (delErr) throw new DbError(delErr);

  const { error: storageErr } = await ctx.supabase.storage
    .from(DOCUMENT_BUCKET)
    .remove([existing.storage_path]);
  if (storageErr) {
    ctx.log.warn(
      { err: storageErr, path: existing.storage_path, documentId },
      'failed to remove storage object after row delete (orphan, will be reaped)',
    );
  }
}
