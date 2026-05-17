/**
 * Standard error envelope used by every Route Handler response.
 *
 * Server returns: `{ data }` on success, `{ error: { code, message, details, requestId } }` on failure.
 */
export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
};

export type ApiResponse<T> = { data: T } | { error: ApiError };

/**
 * Custom error class thrown by the HTTP layer. Each instance carries the
 * structured server error so callers can switch on `code`.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = 'HttpError';
    this.status = status;
    this.code = error.code;
    this.details = error.details;
    this.requestId = error.requestId;
  }
}

export class NetworkError extends Error {
  override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}
