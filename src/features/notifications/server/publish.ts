import 'server-only';
import { NOTIFICATION_KIND_RULES, type NotificationKind } from '@/core/constants/notifications';
import { parseNotificationPreferences, resolveChannels } from '@/core/utils/notification-rules';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Centralised publisher for in-app notifications.
 *
 * Every server-side event that wants to notify a user calls this helper
 * once per recipient. It:
 *   1. Reads `profiles.notification_prefs` to get per-kind channel toggles.
 *   2. Always inserts a row into `public.notifications` (in-app is the
 *      audit trail; muting only hides it from the bell, not the database).
 *   3. Returns whether email *should* be sent so the caller can fan out
 *      to Resend with the appropriate template. We don't send the email
 *      from here because each kind has its own templated content; this
 *      keeps `lib/email/templates/*` as the single source of email copy.
 *
 * Caller pattern (see `features/tickets/server/notifications.ts`):
 *
 *   for (const recipient of recipients) {
 *     const decision = await publishNotification({ user_id, kind, ... });
 *     if (decision.email) await sendEmail({ ... });
 *   }
 *
 * Failures are logged but never thrown — a notification failing must not
 * block the underlying business event (e.g. a ticket should still get
 * created even if Resend is down or the row can't be written).
 */

// Lazy logger — never call getLogger() at module import time so a single
// misconfigured optional env var can't crash any route that imports this
// module. The first call inside an actual request creates + caches it.
const log = () => getLogger().child({ module: 'notifications.publish' });

export type PublishNotificationInput = {
  user_id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  link_url?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  meta?: Record<string, unknown>;
};

export type PublishNotificationResult = {
  /** Set when the row was written (i.e. in-app delivery succeeded). */
  notification_id: string | null;
  /** True when the user's preferences allow an email fan-out for this kind. */
  email: boolean;
  /** True when the in-app delivery succeeded. */
  in_app: boolean;
};

export async function publishNotification(
  input: PublishNotificationInput,
): Promise<PublishNotificationResult> {
  const sb = createServiceClient();

  let preferences: ReturnType<typeof parseNotificationPreferences>;
  try {
    const { data: profile, error } = await sb
      .from('profiles')
      .select('notification_prefs')
      .eq('id', input.user_id)
      .maybeSingle();
    if (error) {
      log().warn({ err: error, user_id: input.user_id }, 'prefs lookup failed; using defaults');
    }
    preferences = parseNotificationPreferences(profile?.notification_prefs ?? null);
  } catch (err) {
    log().warn({ err, user_id: input.user_id }, 'prefs parse failed; using defaults');
    preferences = parseNotificationPreferences(null);
  }

  const decision = resolveChannels(preferences, input.kind);
  const rule = NOTIFICATION_KIND_RULES[input.kind];

  let notificationId: string | null = null;
  if (decision.in_app) {
    const { data, error } = await sb
      .from('notifications')
      .insert({
        user_id: input.user_id,
        kind: input.kind,
        title: input.title,
        body: input.body ?? '',
        link_url: input.link_url ?? null,
        entity_type: input.entity_type ?? null,
        entity_id: input.entity_id ?? null,
        meta: (input.meta ?? {}) as never,
      })
      .select('id')
      .maybeSingle();
    if (error) {
      log().error(
        { err: error, user_id: input.user_id, kind: input.kind },
        'in-app notification insert failed',
      );
    } else {
      notificationId = data?.id ?? null;
    }
  }

  return {
    notification_id: notificationId,
    email: decision.email && (rule.defaults.email || rule.critical),
    in_app: notificationId !== null,
  };
}

/**
 * Stamp a notification as "we just queued the email for delivery".
 *
 * Best-effort; failure is logged but does not affect the email send. Used
 * by callers that want the bell row to reflect "we also emailed you".
 */
export async function markEmailDelivered(notificationId: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('notifications')
    .update({ delivered_email_at: new Date().toISOString() })
    .eq('id', notificationId);
  if (error) {
    log().warn({ err: error, notificationId }, 'failed to stamp email delivery');
  }
}
