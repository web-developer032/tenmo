import 'server-only';
import { DbError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Past exports — surfaced on the tenant's `/tenant/passport` page
 * so they can re-download or audit who pulled their record.
 *
 * Returns the rows ordered most-recent-first, with a fresh signed
 * URL minted for each (TTL=5min). RLS is enforced through the
 * request-bound supabase client; the signed URLs are minted via the
 * service client because storage signing only works with elevated
 * privileges.
 */

export interface PassportExportListItem {
  id: string;
  generated_at: string;
  storage_path: string;
  download_url: string | null;
  summary: Record<string, unknown> | null;
}

const SIGNED_URL_TTL_SECONDS = 60 * 5;

export async function listPassportExportsForCaller(
  ctx: HandlerContext,
  limit = 10,
): Promise<PassportExportListItem[]> {
  requireUser(ctx);

  const { data, error } = await ctx.supabase
    .from('passport_exports')
    .select('id, generated_at, storage_path, summary')
    .order('generated_at', { ascending: false })
    .limit(limit);
  if (error) throw new DbError(error);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const service = createServiceClient();
  const signed = await service.storage.from('rental-passports').createSignedUrls(
    rows.map((r) => r.storage_path),
    SIGNED_URL_TTL_SECONDS,
  );

  const urlByPath = new Map<string, string>();
  for (const entry of signed.data ?? []) {
    if (entry.path && entry.signedUrl) {
      urlByPath.set(entry.path, entry.signedUrl);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    generated_at: r.generated_at,
    storage_path: r.storage_path,
    download_url: urlByPath.get(r.storage_path) ?? null,
    summary: (r.summary as Record<string, unknown> | null) ?? null,
  }));
}
