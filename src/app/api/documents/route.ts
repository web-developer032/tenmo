import {
  DocumentCategoryEnum,
  DocumentKindEnum,
  DocumentListFilter,
  RecordDocumentInput,
} from '@/core/schemas/document';
import { listDocuments, recordDocument } from '@/features/documents/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/documents — list documents the caller can see.
 *
 * All filters are optional + RLS-scoped:
 *   - org_id, kind, property_id, room_id, tenancy_id, compliance_item_id
 *   - categories=ast,certificate (comma-separated)
 *   - limit=20, before=<iso>
 */
export const GET = handler(
  async (ctx) => {
    const url = ctx.req.nextUrl;
    const limitRaw = url.searchParams.get('limit');
    const kindRaw = url.searchParams.get('kind');
    const categoriesRaw = url.searchParams.get('categories');
    const filter = DocumentListFilter.parse({
      org_id: url.searchParams.get('org_id') ?? undefined,
      kind: kindRaw ? DocumentKindEnum.parse(kindRaw) : undefined,
      categories: categoriesRaw
        ? categoriesRaw
            .split(',')
            .filter(Boolean)
            .map((c) => DocumentCategoryEnum.parse(c))
        : undefined,
      property_id: url.searchParams.get('property_id') ?? undefined,
      room_id: url.searchParams.get('room_id') ?? undefined,
      tenancy_id: url.searchParams.get('tenancy_id') ?? undefined,
      compliance_item_id: url.searchParams.get('compliance_item_id') ?? undefined,
      limit: limitRaw ? Number(limitRaw) : 20,
      before: url.searchParams.get('before') ?? undefined,
    });

    const documents = await listDocuments(ctx, filter);
    return Response.json({ data: { documents } });
  },
  { requireAuth: true },
);

/**
 * POST /api/documents — record a document row after the client has
 * uploaded the bytes via the signed PUT URL.
 *
 * For `compliance` certs and `tenancy` ASTs we also stamp the headline
 * `document_path` / `ast_document_path` pointer on the parent row (see
 * `recordDocument`).
 */
export const POST = handler(
  async (ctx) => {
    const json = await ctx.req.json().catch(() => ({}));
    const input = RecordDocumentInput.parse(json);
    const document = await recordDocument(ctx, input);
    return Response.json({ data: { document } }, { status: 201 });
  },
  { requireAuth: true },
);
