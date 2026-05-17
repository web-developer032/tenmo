/**
 * Centralised error codes used across the API.
 * Frontend code can reliably switch on these.
 */
export const ErrorCode = {
  // 400
  validation_error: 'validation_error',
  bad_request: 'bad_request',

  // 401
  unauthorized: 'unauthorized',
  invalid_session: 'invalid_session',

  // 403
  forbidden: 'forbidden',
  not_org_member: 'not_org_member',
  not_tenant_of_tenancy: 'not_tenant_of_tenancy',
  not_admin: 'not_admin',
  tier_required: 'tier_required',

  // 404
  not_found: 'not_found',

  // 409
  conflict: 'conflict',
  already_exists: 'already_exists',
  idempotency_replay: 'idempotency_replay',

  // 410
  gone: 'gone',

  // 429
  rate_limited: 'rate_limited',

  // 422
  business_rule_violation: 'business_rule_violation',

  // 5xx
  internal_error: 'internal_error',
  db_error: 'db_error',
  integration_error: 'integration_error',
  not_implemented: 'not_implemented',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown, message = 'Invalid request body') {
    super(400, ErrorCode.validation_error, message, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Sign in required') {
    super(401, ErrorCode.unauthorized, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(code: ErrorCode = ErrorCode.forbidden, message = 'Forbidden') {
    super(403, code, message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, ErrorCode.not_found, message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(code: ErrorCode = ErrorCode.conflict, message = 'Conflict') {
    super(409, code, message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(429, ErrorCode.rate_limited, message);
    this.name = 'RateLimitError';
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, ErrorCode.business_rule_violation, message, details);
    this.name = 'BusinessRuleError';
  }
}

/**
 * Pull the useful bits out of an unknown thrown value so they end up in
 * `DbError.details.cause` as readable JSON instead of `"[object Object]"`.
 *
 * Supabase / PostgREST errors look like:
 *   { code, message, details, hint }
 * `Error` instances expose `.message` / `.stack`. Anything else falls back
 * to `String(value)`.
 */
function serializeDbCause(cause: unknown): string | Record<string, unknown> {
  if (cause === null || cause === undefined) return 'unknown';
  if (typeof cause === 'string') return cause;
  if (cause instanceof Error) {
    return { name: cause.name, message: cause.message };
  }
  if (typeof cause === 'object') {
    const c = cause as Record<string, unknown>;
    const picked: Record<string, unknown> = {};
    for (const key of ['code', 'message', 'details', 'hint'] as const) {
      if (c[key] !== undefined) picked[key] = c[key];
    }
    if (Object.keys(picked).length > 0) return picked;
    try {
      return JSON.parse(JSON.stringify(cause));
    } catch {
      return String(cause);
    }
  }
  return String(cause);
}

export class DbError extends AppError {
  constructor(cause: unknown, message = 'Database error') {
    super(500, ErrorCode.db_error, message, { cause: serializeDbCause(cause) });
    this.name = 'DbError';
  }
}

export class IntegrationError extends AppError {
  constructor(provider: string, message: string, details?: unknown) {
    super(502, ErrorCode.integration_error, `${provider}: ${message}`, details);
    this.name = 'IntegrationError';
  }
}
