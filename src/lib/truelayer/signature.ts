import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getServerEnv } from '@/lib/env.server';
import { AppError, ErrorCode } from '@/lib/errors';

/**
 * TrueLayer webhook signature verification.
 *
 * TrueLayer signs webhooks with HMAC-SHA256 using the shared
 * `TRUELAYER_WEBHOOK_SECRET`. The signature is sent in the
 * `Tl-Signature` header. As with Stripe / GoCardless we verify
 * before any business logic touches the payload, and we fail
 * closed if the secret isn't configured.
 *
 * Reference: https://docs.truelayer.com/docs/webhook-signature-verification
 *
 * Note: TrueLayer's production signatures are JWS-style with
 * additional URL/timestamp fields. The simpler HMAC mode is used
 * by their sandbox and by the legacy `signatureV1` deployments
 * that this project currently targets. If you upgrade to JWS
 * webhooks, swap the verification logic in this single file —
 * the route handler doesn't need to know.
 */

export class TrueLayerWebhookSecretMissingError extends AppError {
  constructor() {
    super(
      503,
      ErrorCode.integration_error,
      'TrueLayer webhook secret is not configured. Set TRUELAYER_WEBHOOK_SECRET.',
    );
    this.name = 'TrueLayerWebhookSecretMissingError';
  }
}

export function verifyTrueLayerSignature(rawBody: string, signature: string | null): void {
  const env = getServerEnv();
  if (!env.TRUELAYER_WEBHOOK_SECRET) {
    throw new TrueLayerWebhookSecretMissingError();
  }
  if (!signature) {
    throw new AppError(400, ErrorCode.bad_request, 'Missing Tl-Signature header');
  }

  const expected = createHmac('sha256', env.TRUELAYER_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = bufferFromHex(signature);
  if (!b || a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError(400, ErrorCode.bad_request, 'Invalid TrueLayer signature');
  }
}

function bufferFromHex(s: string): Buffer | null {
  if (!/^[0-9a-fA-F]*$/.test(s) || s.length % 2 !== 0) return null;
  return Buffer.from(s, 'hex');
}
