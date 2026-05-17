import { z } from 'zod';
import { LOCALE_VALUES, TIMEZONE_VALUES } from '../constants/profile';
import { optionalContactEmail, optionalContactPhone, optionalString, uuid } from './common';

/**
 * Profile — the public-facing companion to `auth.users`.
 * One row per authenticated user.
 */
export const NotificationPrefs = z.object({
  email: z.boolean().default(true),
  in_app: z.boolean().default(true),
  sms: z.boolean().default(false),
});
export type NotificationPrefs = z.infer<typeof NotificationPrefs>;

/**
 * The active context lives in the URL but is also persisted on `profiles`
 * so we can restore the previous workspace on a fresh login.
 */
export const ActiveContext = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('landlord'),
    orgId: uuid,
    orgSlug: z.string(),
  }),
  z.object({
    kind: z.literal('tenant'),
  }),
  z.object({
    kind: z.literal('admin'),
  }),
]);
export type ActiveContext = z.infer<typeof ActiveContext>;

export const Profile = z.object({
  id: uuid,
  full_name: z.string().nullable(),
  preferred_name: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
  contact_email: z.string().email().nullable(),
  contact_phone: z.string().nullable(),
  locale: z.string().default('en-GB'),
  timezone: z.string().default('Europe/London'),
  notification_prefs: NotificationPrefs,
  last_active_context: ActiveContext.nullable(),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  marketing_opt_in: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Profile = z.infer<typeof Profile>;

/** Form schema for editing a user's profile. */
export const ProfileUpdate = Profile.pick({
  full_name: true,
  preferred_name: true,
  contact_email: true,
  contact_phone: true,
  locale: true,
  timezone: true,
  theme: true,
  marketing_opt_in: true,
  notification_prefs: true,
}).partial();
export type ProfileUpdate = z.infer<typeof ProfileUpdate>;

/**
 * Form-friendly variant of `ProfileUpdate`. Used by both the client form
 * (RHF + zodResolver) and the `PATCH /api/profile` route handler so the
 * shape is validated identically on both sides.
 *
 * Differs from `ProfileUpdate` in two ways:
 *   1. Optional string fields use `optionalString` so blank `<input>`
 *      values (`""` / `null`) are coerced to `undefined` rather than
 *      tripping `.email()` / `.min(1)` validators (same trick as the
 *      org-create form — see ADR-0007 / common.ts comment).
 *   2. Locale and timezone are constrained to the curated dropdowns in
 *      `core/constants/profile.ts` so we can't accidentally store a typo
 *      that breaks `Intl.DateTimeFormat`.
 *
 * Notification prefs are intentionally omitted — they live behind their
 * own dedicated route (`/account/settings/notifications`) and have a
 * richer schema (`NotificationPreferencesPatch`).
 */
export const ProfileEditInput = z.object({
  full_name: optionalString(z.string().trim().min(1, 'Name is required').max(120)),
  preferred_name: optionalString(z.string().trim().min(1).max(60)),
  contact_email: optionalContactEmail,
  contact_phone: optionalContactPhone,
  locale: z.enum(LOCALE_VALUES as [string, ...string[]]).optional(),
  timezone: z.enum(TIMEZONE_VALUES as [string, ...string[]]).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  marketing_opt_in: z.boolean().optional(),
});
export type ProfileEditInput = z.infer<typeof ProfileEditInput>;

/** Initial-onboarding choice — what flow the user wants to start with. */
export const OnboardingChoice = z.enum(['landlord', 'tenant', 'both']);
export type OnboardingChoice = z.infer<typeof OnboardingChoice>;
