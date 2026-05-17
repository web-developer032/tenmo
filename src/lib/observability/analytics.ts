import 'server-only';
import type { AnalyticsEventName } from '@/core/constants/analytics';
import { getLogger } from '@/lib/logger';
import { getPostHogServer } from './posthog-server';

/**
 * Server-side analytics emitter.
 *
 * Fires-and-forgets — never throws, never blocks the request,
 * always logs. Unifies PostHog + the structured logger so a
 * call site never needs to know which sink is configured.
 *
 * The browser counterpart lives in
 * `lib/observability/posthog-client.ts`'s `usePostHog()` hook.
 */

export interface TrackInput {
  event: AnalyticsEventName;
  /** Required — PostHog needs a stable identifier per actor. Use
   * the auth user id or, for anonymous flows, a session-stable
   * UUID kept in a cookie. */
  distinctId: string;
  properties?: Record<string, unknown>;
  /** Optional org context. Surfaced as PostHog "groups" so we
   * can pivot insights by org without enriching every event. */
  orgId?: string;
}

export async function trackServer(input: TrackInput): Promise<void> {
  const log = getLogger();
  log.info(
    {
      analytics: input.event,
      distinctId: input.distinctId,
      orgId: input.orgId,
      properties: input.properties,
    },
    'analytics.track',
  );

  const posthog = getPostHogServer();
  if (!posthog) return;

  try {
    posthog.capture({
      distinctId: input.distinctId,
      event: input.event,
      properties: input.properties,
      groups: input.orgId ? { org: input.orgId } : undefined,
    });
  } catch (err) {
    log.warn({ err, event: input.event }, 'posthog server capture failed');
  }
}

/**
 * Stamp an org's metadata so PostHog Insights can group rows by
 * tier / created_at without joining back to Postgres. Best-effort.
 */
export async function identifyOrg(
  orgId: string,
  properties: Record<string, unknown>,
): Promise<void> {
  const posthog = getPostHogServer();
  if (!posthog) return;
  try {
    posthog.groupIdentify({ groupType: 'org', groupKey: orgId, properties });
  } catch (err) {
    getLogger().warn({ err, orgId }, 'posthog groupIdentify failed');
  }
}
