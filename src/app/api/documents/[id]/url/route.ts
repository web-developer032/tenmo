import { z } from 'zod';
import { uuid } from '@/core/schemas/common';
import { signDocumentDownloadUrl } from '@/features/documents/server';
import { handler } from '@/lib/handler';

const ParamsSchema = z.object({ id: uuid });

/**
 * GET /api/documents/[id]/url — mint a 1-hour signed download URL.
 *
 * Returns 404 if the caller cannot see the row, never leaking the
 * underlying storage path.
 */
export const GET = handler<{ id: string }>(
  async (ctx, params) => {
    const { id } = ParamsSchema.parse(params);
    const result = await signDocumentDownloadUrl(ctx, id);
    return Response.json({ data: result });
  },
  { requireAuth: true },
);
