import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getServerEnv } from '@/lib/env.server';
import { AppError, ErrorCode } from '@/lib/errors';

/**
 * GoCardless webhook signature verification.
 *
 * GC sends `Webhook-Signature: <hex>` where the hex is HMAC-SHA256 of
 * the raw body using the shared `GOCARDLESS_WEBHOOK_SECRET`. We must
 * verify before any business logic touches the payload.
 *
 * Reference: https://developer.gocardless.com/api-reference/#webhooks-signing-webhooks
 */

export class GoCardlessWebhookSecretMissingError extends AppError {
  constructor() {
    super(
      503,
      ErrorCode.integration_error,
      'GoCardless webhook secret is not configured. Set GOCARDLESS_WEBHOOK_SECRET.',
    );
    this.name = 'GoCardlessWebhookSecretMissingError';
  }
}

/**
 * Compute the expected signature for a body, then constant-time
 * compare it to the one in the header. Throws AppError(400) on
 * mismatch / missing header. Throws 503 when the secret isn't set
 * (we never accept unsigned payloads, even in dev).
 */
export function verifyGoCardlessSignature(rawBody: string, signature: string | null): void {
  const env = getServerEnv();
  if (!env.GOCARDLESS_WEBHOOK_SECRET) {
    throw new GoCardlessWebhookSecretMissingError();
  }
  if (!signature) {
    throw new AppError(400, ErrorCode.bad_request, 'Missing Webhook-Signature header');
  }

  const expected = createHmac('sha256', env.GOCARDLESS_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = bufferFromHex(signature);
  if (!b || a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError(400, ErrorCode.bad_request, 'Invalid GoCardless signature');
  }
}

/** Defensive hex parser — returns null if the input isn't valid hex
 * so we can return 400 cleanly instead of throwing in the crypto layer. */
function bufferFromHex(s: string): Buffer | null {
  if (!/^[0-9a-fA-F]*$/.test(s) || s.length % 2 !== 0) return null;
  return Buffer.from(s, 'hex');
}
