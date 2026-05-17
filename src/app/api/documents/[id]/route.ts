import { z } from 'zod';
import { uuid } from '@/core/schemas/common';
import { deleteDocument } from '@/features/documents/server';
import { handler } from '@/lib/handler';

const ParamsSchema = z.object({ id: uuid });

/** DELETE /api/documents/[id] — owner-only delete (RLS-enforced). */
export const DELETE = handler<{ id: string }>(
  async (ctx, params) => {
    const { id } = ParamsSchema.parse(params);
    await deleteDocument(ctx, id);
    return Response.json({ data: { id } });
  },
  { requireAuth: true },
);
