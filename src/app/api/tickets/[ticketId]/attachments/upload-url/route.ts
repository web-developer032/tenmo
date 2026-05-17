import { z } from 'zod';
import {
  TICKET_ATTACHMENT_MAX_BYTES,
  TICKET_ATTACHMENT_MIME_ALLOWLIST,
  type TicketAttachmentMime,
} from '@/core/constants/tickets';
import { createAttachmentUploadUrl } from '@/features/tickets/server';
import { handler } from '@/lib/handler';

const Body = z.object({
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

/**
 * POST /api/tickets/[ticketId]/attachments/upload-url
 *
 * Returns a short-lived signed URL that the browser POSTs the file to
 * directly. We never proxy bytes through the API.
 *
 * The path returned is what the client should send back when posting the
 * message: `attachment_paths: [path1, path2, …]`.
 */
export const POST = handler<{ ticketId: string }>(
  async (ctx, params) => {
    const json = await ctx.req.json().catch(() => ({}));
    const input = Body.parse(json);

    const result = await createAttachmentUploadUrl(ctx, {
      ticket_id: params.ticketId,
      filename: input.filename,
      mime_type: input.mime_type,
      size_bytes: input.size_bytes,
    });
    return Response.json({ data: result }, { status: 201 });
  },
  { requireAuth: true },
);
