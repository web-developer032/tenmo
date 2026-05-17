import 'server-only';
import { z } from 'zod';
import {
  TICKET_ATTACHMENT_MAX_BYTES,
  TICKET_ATTACHMENT_MIME_ALLOWLIST,
  type TicketAttachmentMime,
} from '@/core/constants/tickets';
import { uuid } from '@/core/schemas/common';
import { BusinessRuleError, DbError, NotFoundError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';

/**
 * Storage helpers for the `ticket-attachments` bucket.
 *
 * Path convention (also enforced by storage RLS):
 *
 *   {org_id}/{ticket_id}/{nanoid}-{filename}
 *
 * Clients ask the server for a signed upload URL → upload directly →
 * tell the server the resulting path when they post the message. We never
 * proxy file bytes through the API.
 */

const BUCKET = 'ticket-attachments';

export const CreateAttachmentUploadUrlInput = z.object({
  ticket_id: uuid,
  filename: z.string().trim().min(1).max(180),
  mime_type: z
    .string()
    .refine(
      (v): v is TicketAttachmentMime =>
        (TICKET_ATTACHMENT_MIME_ALLOWLIST as readonly string[]).includes(v),
      { message: 'Unsupported file type' },
    ),
  size_bytes: z.number().int().positive().max(TICKET_ATTACHMENT_MAX_BYTES, 'File too large'),
});
export type CreateAttachmentUploadUrlInput = z.infer<typeof CreateAttachmentUploadUrlInput>;

export type AttachmentUploadUrl = {
  /** Storage path the client should record on the message. */
  path: string;
  /** Direct upload URL (signed, short-lived). */
  signedUrl: string;
  /** Signed-URL token (so the client can use it with the helper SDK). */
  token: string;
  expiresInSeconds: number;
};

const SIGN_UPLOAD_TTL_SECONDS = 60 * 5; // 5 minutes — generous for big videos
const SIGN_DOWNLOAD_TTL_SECONDS = 60 * 60; // 1 hour — for inline previews

/**
 * Mint a signed upload URL for a ticket attachment.
 *
 * Verifies the caller can see the ticket (RLS via SELECT). If the user can't
 * see the ticket, the SELECT returns no rows and we fail with NotFoundError —
 * never leaking the existence of the ticket.
 */
export async function createAttachmentUploadUrl(
  ctx: HandlerContext,
  input: CreateAttachmentUploadUrlInput,
): Promise<AttachmentUploadUrl> {
  const { data: ticket, error: tErr } = await ctx.supabase
    .from('tickets')
    .select('id, org_id')
    .eq('id', input.ticket_id)
    .maybeSingle();
  if (tErr) throw new DbError(tErr);
  if (!ticket) throw new NotFoundError('Ticket not found');

  const safe = sanitiseFilename(input.filename);
  const path = `${ticket.org_id}/${ticket.id}/${randomKey()}-${safe}`;

  const { data, error } = await ctx.supabase.storage.from(BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    ctx.log.error({ err: error, path }, 'createSignedUploadUrl failed');
    throw new BusinessRuleError(error?.message ?? 'Could not create upload URL');
  }

  return {
    path: data.path,
    signedUrl: data.signedUrl,
    token: data.token,
    expiresInSeconds: SIGN_UPLOAD_TTL_SECONDS,
  };
}

/**
 * Mint a signed download URL for a previously-uploaded attachment.
 *
 * RLS gates the underlying object — if the user can't see the ticket they
 * also can't read the object, and we surface that as NotFoundError to avoid
 * leaking storage layout.
 */
export async function signAttachmentDownloadUrl(
  ctx: HandlerContext,
  path: string,
): Promise<{ url: string; expiresInSeconds: number }> {
  const { data, error } = await ctx.supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGN_DOWNLOAD_TTL_SECONDS);

  if (error || !data) {
    ctx.log.warn({ err: error, path }, 'createSignedUrl failed');
    throw new NotFoundError('Attachment not found');
  }

  return { url: data.signedUrl, expiresInSeconds: SIGN_DOWNLOAD_TTL_SECONDS };
}

function sanitiseFilename(name: string): string {
  // Strip path separators + collapse weird characters; keep extension.
  const trimmed = name.trim().replace(/[\\/]/g, '_');
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file';
}

function randomKey(): string {
  // 12 base36 chars ≈ 60 bits, plenty for collision avoidance per ticket.
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
}
