import 'server-only';
import type { PassportData } from '@/core/schemas/passport';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { assemblePassportForUser } from './server/assemble-passport';
import type { PassportExportListItem } from './server/list-exports';

/**
 * RSC-friendly loaders for the Rental Passport feature. Used by the
 * tenant-facing pages — the route handlers use the corresponding
 * server modules directly.
 */

const SIGNED_URL_TTL_SECONDS = 60 * 5;

export async function loadPassportForCaller(): Promise<PassportData | null> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  return assemblePassportForUser(sb, user);
}

export async function loadPassportExportsForCaller(limit = 10): Promise<PassportExportListItem[]> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return [];

  const { data, error } = await sb
    .from('passport_exports')
    .select('id, generated_at, storage_path, summary')
    .order('generated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
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
