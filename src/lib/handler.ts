import type { SupabaseClient, User } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, ErrorCode, UnauthorizedError, ValidationError } from '@/lib/errors';
import { getLogger } from '@/lib/logger';
import { captureError } from '@/lib/observability/sentry';
import { createClient } from '@/lib/supabase/server';

/**
 * Context passed to every Route Handler — opinionated, batteries included.
 */
export type HandlerContext = {
  req: NextRequest;
  supabase: SupabaseClient;
  user: User | null;
  requestId: string;
  log: ReturnType<typeof getLogger>;
};

export type HandlerOptions = {
  /** Set to true to require an authenticated user; otherwise `user` may be null. */
  requireAuth?: boolean;
};

type RouteParams<P extends Record<string, string | string[]> = Record<string, never>> = {
  params: Promise<P>;
};

type RouteHandler<P extends Record<string, string | string[]> = Record<string, never>> = (
  request: NextRequest,
  routeContext: RouteParams<P>,
) => Promise<Response> | Response;

/**
 * Wrap a Route Handler with consistent error envelope, request ID, logger, and
 * authenticated Supabase client.
 *
 * Usage:
 *
 * ```ts
 * export const POST = handler(async ({ req, supabase, user }) => {
 *   const body = MySchema.parse(await req.json());
 *   const { data, error } = await supabase.from('orgs').insert({ ... });
 *   if (error) throw new DbError(error);
 *   return Response.json({ data }, { status: 201 });
 * }, { requireAuth: true });
 * ```
 */
export function handler<P extends Record<string, string | string[]> = Record<string, never>>(
  fn: (ctx: HandlerContext, params: P) => Promise<Response>,
  options: HandlerOptions = {},
): RouteHandler<P> {
  return async (request, routeContext) => {
    const requestId = request.headers.get('x-request-id') ?? nanoid();
    const log = getLogger().child({
      requestId,
      route: request.nextUrl.pathname,
      method: request.method,
    });

    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (options.requireAuth && !user) {
        throw new UnauthorizedError();
      }

      const params = (await routeContext.params) as P;

      const response = await fn({ req: request, supabase, user, requestId, log }, params);

      const headers = new Headers(response.headers);
      headers.set('x-request-id', requestId);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (err) {
      return mapErrorToResponse(err, requestId, log);
    }
  };
}

function mapErrorToResponse(
  err: unknown,
  requestId: string,
  log: ReturnType<typeof getLogger>,
): Response {
  if (err instanceof ZodError) {
    log.warn({ err: err.issues }, 'validation error');
    return errorResponse(new ValidationError(err.issues), requestId);
  }
  if (err instanceof AppError) {
    if (err.status >= 500) {
      log.error({ err }, err.message);
      captureError(err, { requestId, code: err.code, status: err.status });
    } else {
      log.warn({ err: { code: err.code, status: err.status, message: err.message } }, err.message);
    }
    return errorResponse(err, requestId);
  }
  log.error({ err }, 'Unhandled error');
  captureError(err, { requestId });
  const fallback = new AppError(500, ErrorCode.internal_error, 'Something went wrong');
  return errorResponse(fallback, requestId);
}

function errorResponse(err: AppError, requestId: string): Response {
  return NextResponse.json(
    {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    },
    {
      status: err.status,
      headers: { 'x-request-id': requestId },
    },
  );
}

/**
 * Returns the authenticated user, throwing UnauthorizedError if missing.
 *
 * Use this in handlers that pass `requireAuth: true` to the wrapper — it
 * narrows the `User | null` type to `User` and avoids non-null assertions
 * (`ctx.user!`) at every call site.
 */
export function requireUser(ctx: HandlerContext): User {
  if (!ctx.user) throw new UnauthorizedError();
  return ctx.user;
}

/**
 * Throws if the user is not a member of the org. Use after `requireAuth: true`.
 */
export async function assertOrgMember(
  ctx: HandlerContext,
  orgId: string,
  roles?: ('owner' | 'agent' | 'staff')[],
): Promise<void> {
  if (!ctx.user) throw new UnauthorizedError();
  const { data, error } = await ctx.supabase
    .from('org_memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', ctx.user.id)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) {
    ctx.log.error({ err: error }, 'org membership lookup failed');
    throw new AppError(500, ErrorCode.db_error, 'Could not verify membership');
  }
  if (!data) throw new AppError(403, ErrorCode.not_org_member, 'Not an org member');
  if (roles && !roles.includes(data.role)) {
    throw new AppError(403, ErrorCode.forbidden, `Requires role: ${roles.join(' | ')}`);
  }
}
