import { z } from 'zod';

/**
 * Server-only env (secrets). Never imported from client code; importing this
 * file from a Client Component will fail because the secrets are stripped.
 */

/**
 * Treat empty strings (the default shape of `KEY=` lines in `.env.local`)
 * as "not provided" so `.optional()` actually behaves the way developers
 * expect when copying from `.env.example`. Without this, `UPSTASH_REDIS_REST_URL=`
 * would fail `z.string().url()` and crash any module that triggers env
 * validation at import time.
 *
 * `.optional()` is applied **inside** the preprocessor target so that the
 * undefined produced for empty strings is accepted by the inner schema —
 * a chained `.optional()` on the outside would still validate the inner
 * `z.string()` against undefined and fail.
 */
const blankToUndefined = (v: unknown): unknown =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

const optionalString = () => z.preprocess(blankToUndefined, z.string().optional());
const optionalUrl = () => z.preprocess(blankToUndefined, z.string().url().optional());

/**
 * Resend's "from" can be a bare address (`noreply@tenantly.app`) or the
 * standard display-name form (`Tenantly <noreply@tenantly.app>`); accept
 * both. Empty string → undefined.
 */
const optionalFromEmail = () =>
  z.preprocess(
    blankToUndefined,
    z
      .string()
      .min(3)
      .refine(
        (s) =>
          /^[^<>\s]+@[^<>\s]+\.[^<>\s]+$/.test(s) || /<\s*[^<>\s]+@[^<>\s]+\.[^<>\s]+\s*>/.test(s),
        { message: 'must be an email or "Name <email@domain>" form' },
      )
      .optional(),
  );

const optionalCronSecret = () => z.preprocess(blankToUndefined, z.string().min(16).optional());

const optionalEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess(blankToUndefined, z.enum(values).optional());

const ServerEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESEND_API_KEY: optionalString(),
  RESEND_FROM_EMAIL: optionalFromEmail(),
  INNGEST_EVENT_KEY: optionalString(),
  INNGEST_SIGNING_KEY: optionalString(),
  STRIPE_SECRET_KEY: optionalString(),
  STRIPE_WEBHOOK_SECRET: optionalString(),
  // Per-tier Price IDs from the Stripe dashboard. Empty in dev unless
  // you've created sandbox prices; the checkout endpoint surfaces a
  // clear 503 if the requested tier+interval is unconfigured.
  STRIPE_PRICE_STARTER_MONTHLY: optionalString(),
  STRIPE_PRICE_STARTER_ANNUAL: optionalString(),
  STRIPE_PRICE_PRO_MONTHLY: optionalString(),
  STRIPE_PRICE_PRO_ANNUAL: optionalString(),
  STRIPE_PRICE_PORTFOLIO_MONTHLY: optionalString(),
  STRIPE_PRICE_PORTFOLIO_ANNUAL: optionalString(),
  GOCARDLESS_ACCESS_TOKEN: optionalString(),
  GOCARDLESS_ENVIRONMENT: optionalEnum(['sandbox', 'live']),
  GOCARDLESS_WEBHOOK_SECRET: optionalString(),
  TRUELAYER_CLIENT_ID: optionalString(),
  TRUELAYER_CLIENT_SECRET: optionalString(),
  TRUELAYER_WEBHOOK_SECRET: optionalString(),
  /**
   * Optional explicit override — defaults are picked from
   * `TRUELAYER_CLIENT_ID` ("sandbox-" prefix → sandbox). Set to `live`
   * when you're using a non-prefixed live client id.
   */
  TRUELAYER_ENVIRONMENT: optionalEnum(['sandbox', 'live']),
  TWILIO_ACCOUNT_SID: optionalString(),
  TWILIO_AUTH_TOKEN: optionalString(),
  TWILIO_FROM_NUMBER: optionalString(),
  DOCUSEAL_API_URL: optionalUrl(),
  DOCUSEAL_API_TOKEN: optionalString(),
  DOCUSEAL_WEBHOOK_SECRET: optionalString(),
  DOCUSEAL_AST_TEMPLATE_ID: optionalString(),
  UPSTASH_REDIS_REST_URL: optionalUrl(),
  UPSTASH_REDIS_REST_TOKEN: optionalString(),
  SENTRY_AUTH_TOKEN: optionalString(),
  SENTRY_ORG: optionalString(),
  SENTRY_PROJECT: optionalString(),
  /**
   * Shared secret used by Vercel Cron (and `curl` in dev) to authenticate
   * scheduled jobs. Sent as `Authorization: Bearer <CRON_SECRET>`.
   * If unset in dev, cron routes accept requests from `127.0.0.1`/`::1`.
   */
  CRON_SECRET: optionalCronSecret(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid server env vars:\n${issues}`);
  }
  cached = Object.freeze(parsed.data);
  return cached;
}
