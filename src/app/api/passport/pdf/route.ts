import { GeneratePassportInput } from '@/core/schemas/passport';
import { generatePassportPdf } from '@/features/passport/server';
import { handler } from '@/lib/handler';

/**
 * POST /api/passport/pdf
 *
 * Generates a Rental Passport PDF for the caller and returns a
 * short-lived signed download URL. The body may optionally specify
 * which sections to include (currently informational — the renderer
 * always emits every section in v1, and the field is recorded for
 * future "share with my next landlord" partial-export flows).
 */
export const POST = handler(
  async (ctx) => {
    let body: unknown = {};
    try {
      body = await ctx.req.json();
    } catch {
      // Empty body is fine — we generate with all sections.
      body = {};
    }
    const input = GeneratePassportInput.parse(body);

    const ip =
      ctx.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      ctx.req.headers.get('x-real-ip') ??
      null;
    const userAgent = ctx.req.headers.get('user-agent') ?? null;

    const result = await generatePassportPdf(ctx, input, { ip, user_agent: userAgent });

    return Response.json(
      {
        data: {
          export_id: result.export_id,
          download_url: result.download_url,
          expires_in_seconds: result.expires_in_seconds,
        },
      },
      { status: 201 },
    );
  },
  { requireAuth: true },
);
