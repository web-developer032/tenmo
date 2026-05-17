import {
  NOTIFICATION_KIND_RULES,
  NOTIFICATION_KIND_VALUES,
  type NotificationKind,
  type NotificationKindRule,
} from '../constants/notifications';
import { type NotificationChannelToggles, NotificationPreferences } from '../schemas/notification';

/**
 * Pure helpers for resolving `profiles.notification_prefs` against the
 * per-kind defaults.
 *
 * Kept in `core/` (no `next/`, no `react`, no `supabase` imports) so the
 * same logic can drive the publish helper on the server, the preferences
 * UI, and a future Expo/React-Native build.
 */

export type ResolvedChannelDecision = {
  in_app: boolean;
  email: boolean;
};

/** Hard-coded defaults for the legacy flat shape `{ email, in_app, sms }`. */
const LEGACY_GLOBAL_DEFAULTS = {
  email: true,
  in_app: true,
};

/**
 * Parse the raw `profiles.notification_prefs` jsonb into our typed shape.
 *
 * Accepts:
 *  - the canonical `{ channels, categories }` shape
 *  - the legacy `{ email, in_app, sms }` flat shape (seed data)
 *  - an empty object / null / undefined
 *
 * Anything we can't parse falls back to the canonical defaults.
 */
export function parseNotificationPreferences(raw: unknown): NotificationPreferences {
  if (!raw || typeof raw !== 'object') {
    return NotificationPreferences.parse({});
  }

  const obj = raw as Record<string, unknown>;
  // Legacy flat shape: lift email/in_app into `channels`.
  if (
    !('channels' in obj) &&
    !('categories' in obj) &&
    ('email' in obj || 'in_app' in obj || 'sms' in obj)
  ) {
    return NotificationPreferences.parse({
      channels: {
        email: typeof obj.email === 'boolean' ? obj.email : LEGACY_GLOBAL_DEFAULTS.email,
        in_app: typeof obj.in_app === 'boolean' ? obj.in_app : LEGACY_GLOBAL_DEFAULTS.in_app,
      },
      categories: {},
    });
  }

  const result = NotificationPreferences.safeParse(obj);
  if (result.success) return result.data;
  return NotificationPreferences.parse({});
}

/**
 * Resolve which channels should fire for a given kind, taking into account:
 *
 *  1. Per-kind override on `prefs.categories[kind]`.
 *  2. Global toggle on `prefs.channels.{email,in_app}` (acts as a kill switch).
 *  3. Per-kind defaults from `NOTIFICATION_KIND_RULES`.
 *  4. Critical kinds: email cannot be disabled (forced true).
 *
 * In-app is always-on for non-system audit-trail reasons. Users can choose
 * not to *see* it (e.g. mute the bell), but it is still written.
 */
export function resolveChannels(
  prefs: NotificationPreferences,
  kind: NotificationKind,
): ResolvedChannelDecision {
  const rule = NOTIFICATION_KIND_RULES[kind];
  const perKind: NotificationChannelToggles | undefined = prefs.categories?.[kind];

  const globalEmail = prefs.channels?.email ?? true;
  const globalInApp = prefs.channels?.in_app ?? true;

  // Email decision: per-kind > (global && default). Critical can't be disabled.
  let email = perKind?.email ?? (globalEmail && rule.defaults.email);
  if (rule.critical) email = true;

  // In-app decision: rule default is always true; allow per-kind opt-out.
  const inApp = perKind?.in_app ?? (globalInApp && rule.defaults.in_app);

  return {
    email: Boolean(email),
    in_app: Boolean(inApp),
  };
}

/** Group kinds by their UI group; ordered to match the preferences page. */
export function groupKinds(): Record<string, NotificationKindRule[]> {
  const groups: Record<string, NotificationKindRule[]> = {};
  for (const kind of NOTIFICATION_KIND_VALUES) {
    const rule = NOTIFICATION_KIND_RULES[kind];
    const bucket = groups[rule.group] ?? [];
    bucket.push(rule);
    groups[rule.group] = bucket;
  }
  return groups;
}

/**
 * Merge a partial preferences patch with the existing prefs. Used by the
 * PATCH endpoint so the UI can submit only the keys that changed.
 */
export function mergePreferences(
  current: NotificationPreferences,
  patch: Partial<NotificationPreferences>,
): NotificationPreferences {
  const merged: NotificationPreferences = {
    channels: { ...current.channels, ...(patch.channels ?? {}) },
    categories: { ...current.categories },
  };
  for (const [kind, toggles] of Object.entries(patch.categories ?? {})) {
    if (!toggles) continue;
    const existing = merged.categories[kind as NotificationKind] ?? {};
    merged.categories[kind as NotificationKind] = { ...existing, ...toggles };
  }
  return merged;
}
