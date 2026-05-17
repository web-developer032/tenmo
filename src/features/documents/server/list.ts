import 'server-only';
import { Document, type DocumentListFilter } from '@/core/schemas/document';
import { DbError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';

/**
 * List documents the caller can see, RLS-scoped.
 *
 * Filters are additive — pass a `tenancy_id` to limit to that tenancy's
 * docs, a `property_id` for the property tab, etc. Pagination is keyset
 * on `created_at` to keep the vault snappy as it grows.
 */
export async function listDocuments(
  ctx: HandlerContext,
  filter: DocumentListFilter,
): Promise<Document[]> {
  requireUser(ctx);

  let q = ctx.supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filter.limit);

  if (filter.org_id) q = q.eq('org_id', filter.org_id);
  if (filter.kind) q = q.eq('kind', filter.kind);
  if (filter.categories && filter.categories.length > 0) q = q.in('category', filter.categories);
  if (filter.property_id) q = q.eq('property_id', filter.property_id);
  if (filter.room_id) q = q.eq('room_id', filter.room_id);
  if (filter.tenancy_id) q = q.eq('tenancy_id', filter.tenancy_id);
  if (filter.compliance_item_id) q = q.eq('compliance_item_id', filter.compliance_item_id);
  if (filter.before) q = q.lt('created_at', filter.before);

  const { data, error } = await q;
  if (error) throw new DbError(error);
  return (data ?? []).map((row) => Document.parse(row));
}
