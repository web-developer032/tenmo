import { previewInvite } from '@/features/tenancies/server';
import { handler } from '@/lib/handler';

/**
 * GET /api/invites/[token] — public preview.
 *
 * No authentication required: the token IS the credential. The backend
 * SECURITY DEFINER function `preview_tenancy_invite` returns a redacted
 * view (no PII for other tenants, no internal IDs beyond what's needed).
 */
export const GET = handler<{ token: string }>(async (ctx, params) => {
  const preview = await previewInvite(ctx, params.token);
  return Response.json({ data: preview });
});
