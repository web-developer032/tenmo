import { z } from 'zod';
import { signAttachmentDownloadUrl } from '@/features/tickets/server';
import { handler } from '@/lib/handler';

const Body = z.object({ path: z.string().trim().min(1) });

/**
 * POST /api/tickets/[ticketId]/attachments/sign
 *
 * Mints a short-lived signed download URL for an attachment that's already
 * been uploaded. RLS gates which paths the caller can read.
 *
 * We accept the path in the body rather than as a path-segment because
 * paths contain slashes.
 */
export const POST = handler(
  async (ctx) => {
    const json = await ctx.req.json().catch(() => ({}));
    const { path } = Body.parse(json);

    const result = await signAttachmentDownloadUrl(ctx, path);
    return Response.json({ data: result });
  },
  { requireAuth: true },
);
