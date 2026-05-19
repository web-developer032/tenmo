import { z } from 'zod';

/**
 * Common, reusable primitive schemas.
 */

/** UK postcode (lenient — formatting only, not validity-checked). */
export const ukPostcode = z
  .string()
  .trim()
  .regex(/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i, 'Invalid UK postcode')
  .transform((v) => v.toUpperCase().replace(/\s+/g, ' '));

/**
 * UUID string — permissive (matches Postgres's `uuid` type).
 *
 * We use Zod v4's `z.guid()` rather than `z.uuid()` because Postgres accepts
 * any well-formed 8-4-4-4-12 hex string regardless of RFC 4122 version /
 * variant nibbles. Our seed data uses readable patterns like
 * `dddddddd-1111-1111-1111-000000000001` for idempotency, which `z.uuid()`
 * (strict RFC 4122) would reject. Production IDs from `gen_random_uuid()`
 * are valid v4 UUIDs and pass either way.
 */
export const uuid = z.guid();

/** Slug: lowercase, hyphens, 3-60 chars. */
export const slug = z
  .string()
  .min(3, 'Use at least 3 characters.')
  .max(60, 'Keep it under 60 characters.')
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    'Use lowercase letters, digits and hyphens only — no spaces, underscores or other symbols.',
  );

/** Money in pence — non-negative integer. */
export const pence = z.number().int().min(0);

/** ISO date string (`YYYY-MM-DD`). */
export const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

/** Single UK address. */
export const Address = z.object({
  line1: z.string().trim().min(1).max(120),
  line2: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().min(1).max(80),
  postcode: ukPostcode,
  country: z.string().trim().default('GB'),
});

export type Address = z.infer<typeof Address>;

/** Currency — for now we only support GBP, but the type leaves room. */
export const Currency = z.enum(['GBP']);
export type Currency = z.infer<typeof Currency>;

/**
 * Wraps a string-like Zod schema so a blank `""`, `null`, or `undefined`
 * input is treated as "not provided" (validates as `undefined`).
 *
 * Why: HTML `<input>` elements always send `""` for empty fields, which
 * fails `.min()` / `.email()` on the underlying validator even when the
 * field is `.optional()`. JSON bodies can also legitimately carry `null`.
 * This helper normalises all three to `undefined`, so optional fields
 * pass — both on the client (RHF + Zod resolver) and the server (Route
 * Handler).
 *
 * Implemented as a `z.union` so the input type stays `string | undefined`
 * (rather than `unknown` as with `z.preprocess`), keeping React Hook Form
 * happy when bound to `<input>` fields.
 *
 * Use in form/API schemas; not for DB-row schemas (where DB values are
 * never `""`).
 *
 * @example
 *   contact_email: optionalString(z.string().trim().email()),
 *   contact_phone: optionalString(z.string().trim().min(7).max(32)),
 */
export function optionalString<T extends z.ZodType<string>>(inner: T) {
  return z.union([
    inner,
    z.literal('').transform(() => undefined),
    z.null().transform(() => undefined),
    z.undefined(),
  ]);
}

/** Optional email; blank input passes as `undefined`. */
export const optionalContactEmail = optionalString(z.string().trim().email());

/** Optional phone; blank input passes as `undefined`. Length 7-32 when present. */
export const optionalContactPhone = optionalString(
  z.string().trim().min(7, 'Phone is too short').max(32, 'Phone is too long'),
);
