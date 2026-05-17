import { z } from 'zod';
import { NOTIFICATION_KIND_VALUES, type NotificationKind } from '../constants/notifications';
import { uuid } from './common';

/**
 * Notification schemas.
 *
 * Mirrors the `public.notifications` table (migration
 * `20260101001200_notifications.sql`) and the typed shape of
 * `profiles.notification_prefs` (jsonb on the existing profiles table).
 */

export const NotificationKindEnum = z.enum(
  NOTIFICATION_KIND_VALUES as [NotificationKind, ...NotificationKind[]],
);

/** A single notification row, as read from the database. */
export const Notification = z.object({
  id: uuid,
  user_id: uuid,
  kind: NotificationKindEnum,
  title: z.string().min(1).max(200),
  body: z.string().max(2000),
  link_url: z.string().nullable(),
  entity_type: z.string().nullable(),
  entity_id: uuid.nullable(),
  meta: z.record(z.string(), z.unknown()).default({}),
  read_at: z.string().nullable(),
  delivered_email_at: z.string().nullable(),
  created_at: z.string(),
});

export type Notification = z.infer<typeof Notification>;

/**
 * Per-kind channel toggles. Stored on `profiles.notification_prefs.categories[kind]`.
 * Both keys optional so the preferences UI can patch a single channel without
 * touching the other.
 */
export const NotificationChannelToggles = z.object({
  email: z.boolean().optional(),
  in_app: z.boolean().optional(),
});

export type NotificationChannelToggles = z.infer<typeof NotificationChannelToggles>;

/**
 * Full preferences payload — the typed shape of `profiles.notification_prefs`.
 *
 * Defaults are applied at read time by `core/utils/notification-rules.ts`;
 * here we only validate the persisted shape. Existing seed data uses the
 * legacy `{ email, in_app, sms }` flat shape — we accept both for
 * backwards compatibility.
 */
// Per-kind toggles — every key is optional because the publisher resolves
// missing entries against `NOTIFICATION_KIND_RULES`. Zod 4's `z.record(enum, T)`
// treats the result as a *complete* map, so we build a partial object schema
// instead and rely on Zod's `.partial()` chain.
const categoriesShape = Object.fromEntries(
  NOTIFICATION_KIND_VALUES.map((k) => [k, NotificationChannelToggles] as const),
) as Record<NotificationKind, typeof NotificationChannelToggles>;

export const NotificationPreferences = z.object({
  channels: z
    .object({
      email: z.boolean().default(true),
      in_app: z.boolean().default(true),
    })
    .partial()
    .default({}),
  categories: z.object(categoriesShape).partial().default({}),
});

export type NotificationPreferences = z.infer<typeof NotificationPreferences>;

/** Writable subset of NotificationPreferences for the API. */
export const NotificationPreferencesPatch = z
  .object({
    channels: z
      .object({
        email: z.boolean().optional(),
        in_app: z.boolean().optional(),
      })
      .optional(),
    categories: z.object(categoriesShape).partial().optional(),
  })
  .strict();

export type NotificationPreferencesPatch = z.infer<typeof NotificationPreferencesPatch>;

/** Input for the "mark a set of notifications read" RPC. */
export const MarkNotificationsReadInput = z.object({
  ids: z.array(uuid).min(1).max(200),
});

export type MarkNotificationsReadInput = z.infer<typeof MarkNotificationsReadInput>;

/** Filter for listing notifications on the bell + full feed. */
export const NotificationListFilter = z.object({
  kinds: z.array(NotificationKindEnum).optional(),
  unread_only: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(25),
  before: z.string().optional(),
});

export type NotificationListFilter = z.infer<typeof NotificationListFilter>;
