import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getServerEnv } from '@/lib/env.server';
import { AppError, ErrorCode } from '@/lib/errors';

/**
 * DocuSeal webhook signature verification.
 *
 * DocuSeal sends `X-DocuSeal-Signature: <hex>` where the hex is
 * HMAC-SHA256 of the raw body using the shared secret configured
 * in DocuSeal admin (and mirrored in `DOCUSEAL_WEBHOOK_SECRET`).
 *
 * Same shape as the GoCardless verifier — kept in its own file so
 * either signature library can evolve without touching the other.
 */

export class DocuSealWebhookSecretMissingError extends AppError {
  constructor() {
    super(
      503,
      ErrorCode.integration_error,
      'DocuSeal webhook secret is not configured. Set DOCUSEAL_WEBHOOK_SECRET.',
    );
    this.name = 'DocuSealWebhookSecretMissingError';
  }
}

export function verifyDocuSealSignature(rawBody: string, signature: string | null): void {
  const env = getServerEnv();
  if (!env.DOCUSEAL_WEBHOOK_SECRET) {
    throw new DocuSealWebhookSecretMissingError();
  }
  if (!signature) {
    throw new AppError(400, ErrorCode.bad_request, 'Missing X-DocuSeal-Signature header');
  }

  const expected = createHmac('sha256', env.DOCUSEAL_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = bufferFromHex(signature);
  if (!b || a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError(400, ErrorCode.bad_request, 'Invalid DocuSeal signature');
  }
}

function bufferFromHex(s: string): Buffer | null {
  if (!/^[0-9a-fA-F]*$/.test(s) || s.length % 2 !== 0) return null;
  return Buffer.from(s, 'hex');
}
