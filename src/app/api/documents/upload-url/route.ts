import { CreateUploadUrlInput } from '@/core/schemas/document';
import { createDocumentUploadUrl } from '@/features/documents/server';
import { handler } from '@/lib/handler';

/**
 * POST /api/documents/upload-url — mint a signed upload URL.
 *
 * The caller never sees the storage path until we tell them; we derive it
 * from the parent's `org_id` so storage RLS can authorise without a join.
 *
 * For `general`-kind uploads the caller passes `org_id` in the body's
 * `parent` payload — the schema currently doesn't include it on the
 * `general` discriminator, so this route refuses general uploads. When
 * we add an "Org documents" surface we'll extend the schema.
 */
export const POST = handler(
  async (ctx) => {
    const json = await ctx.req.json().catch(() => ({}));
    const input = CreateUploadUrlInput.parse(json);
    const result = await createDocumentUploadUrl(ctx, input);
    return Response.json({ data: result }, { status: 201 });
  },
  { requireAuth: true },
);
