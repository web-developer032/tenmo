import { ComplianceItemUpdate } from '@/core/schemas/compliance';
import {
  deleteComplianceItem,
  loadComplianceItem,
  updateComplianceItem,
} from '@/features/compliance/server';
import { NotFoundError } from '@/lib/errors';
import { handler } from '@/lib/handler';

/**
 * GET    /api/compliance/[itemId] — fetch a single compliance item
 * PATCH  /api/compliance/[itemId] — update issued/expiry/notes/document_path
 * DELETE /api/compliance/[itemId] — remove the item (RLS limits to landlord roles)
 *
 * Org membership and role enforcement happen via RLS — the row is invisible
 * (or not mutable) for non-members.
 */
export const GET = handler<{ itemId: string }>(
  async (ctx, params) => {
    const item = await loadComplianceItem(ctx, params.itemId);
    if (!item) throw new NotFoundError('Compliance item not found');
    return Response.json({ data: item });
  },
  { requireAuth: true },
);

export const PATCH = handler<{ itemId: string }>(
  async (ctx, params) => {
    const json = await ctx.req.json().catch(() => ({}));
    const input = ComplianceItemUpdate.parse(json);
    const item = await updateComplianceItem(ctx, params.itemId, input);
    return Response.json({ data: item });
  },
  { requireAuth: true },
);

export const DELETE = handler<{ itemId: string }>(
  async (ctx, params) => {
    await deleteComplianceItem(ctx, params.itemId);
    return new Response(null, { status: 204 });
  },
  { requireAuth: true },
);
