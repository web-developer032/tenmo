import 'server-only';
import { PASSPORT_SECTION_VALUES } from '@/core/constants/passport';
import type { GeneratePassportInput, PassportData } from '@/core/schemas/passport';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { renderPassportPdf } from '@/lib/pdf/passport-renderer';
import { createServiceClient } from '@/lib/supabase/service';
import { assemblePassportForCaller } from './assemble-passport';
import { notifyPassportExported } from './notify-passport';

/**
 * Generate a Rental Passport PDF for the calling user, upload it to
 * the `rental-passports` storage bucket, record the export in
 * `passport_exports`, and return a short-lived signed download
 * URL.
 *
 * The render runs end-to-end inside this single handler call (no
 * background job in MVP). Passports are tiny (single-digit KB), so
 * synchronous generation comfortably fits inside the standard
 * route-handler timeout.
 *
 * Authorisation: only the authenticated user can call this. Storage
 * uploads use the service-role client (because the storage path
 * lives at `{user_id}/...` and we want to be sure the writes
 * succeed regardless of any future RLS tightening on
 * storage.objects).
 */
export interface GeneratePassportPdfResult {
  export_id: string;
  storage_path: string;
  download_url: string;
  expires_in_seconds: number;
  passport: PassportData;
}

const SIGNED_URL_TTL_SECONDS = 60 * 5;

export async function generatePassportPdf(
  ctx: HandlerContext,
  input: GeneratePassportInput,
  meta?: { ip?: string | null; user_agent?: string | null },
): Promise<GeneratePassportPdfResult> {
  const user = requireUser(ctx);

  const passport = await assemblePassportForCaller(ctx);
  const pdfBuffer = await renderPassportPdf(passport);

  const exportId = crypto.randomUUID();
  const storagePath = `${user.id}/${exportId}.pdf`;

  // Upload via the service client — robust to any future RLS
  // change. The storage object stays private; access is via
  // short-lived signed URLs.
  const service = createServiceClient();
  const upload = await service.storage.from('rental-passports').upload(storagePath, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (upload.error) {
    throw new AppError(
      500,
      ErrorCode.internal_error,
      `Could not save passport PDF: ${upload.error.message}`,
    );
  }

  const includedSections = input.sections ?? PASSPORT_SECTION_VALUES;
  const summary = {
    band: passport.payments.band,
    paid_charges: passport.payments.paid_charges,
    on_time_charges: passport.payments.on_time_charges,
    total_paid_pence: passport.payments.total_paid_pence,
    tenancies: passport.tenancies.length,
    rtr_status: passport.right_to_rent.status,
  };

  const { data: row, error: insertErr } = await ctx.supabase
    .from('passport_exports')
    .insert({
      id: exportId,
      user_id: user.id,
      storage_path: storagePath,
      included_sections: includedSections,
      summary,
      generated_ip: meta?.ip ?? null,
      generated_user_agent: meta?.user_agent ?? null,
    })
    .select('id, storage_path')
    .single();
  if (insertErr || !row) {
    // Best-effort cleanup so we don't leak a PDF without a row.
    await service.storage
      .from('rental-passports')
      .remove([storagePath])
      .catch(() => {});
    throw new DbError(insertErr ?? 'no row returned');
  }

  const signed = await service.storage
    .from('rental-passports')
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (signed.error || !signed.data) {
    throw new AppError(
      500,
      ErrorCode.internal_error,
      `Could not sign passport URL: ${signed.error?.message ?? 'unknown error'}`,
    );
  }

  await notifyPassportExported({ user_id: user.id, export_id: row.id });

  return {
    export_id: row.id,
    storage_path: row.storage_path,
    download_url: signed.data.signedUrl,
    expires_in_seconds: SIGNED_URL_TTL_SECONDS,
    passport,
  };
}
