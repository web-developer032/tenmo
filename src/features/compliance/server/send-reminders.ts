import 'server-only';
import type { ComplianceType } from '@/core/constants/compliance';
import { COMPLIANCE_RULES } from '@/core/constants/compliance';
import { reminderBuckets } from '@/core/utils/compliance-rules';
import { publishNotification } from '@/features/notifications/server';
import { renderComplianceReminderEmail, sendEmail } from '@/lib/email';
import { publicEnv } from '@/lib/env.public';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Daily compliance reminder runner.
 *
 * Lifecycle (per cron tick):
 *   1. Build the list of reminder buckets from `core/constants/compliance.ts`
 *      (e.g. {180, 90, 60, 30, 7, 0}).
 *   2. Call `due_compliance_reminders(buckets)` to find items expiring exactly
 *      on one of those bucket days, with no reminder yet sent for that bucket.
 *   3. For each row: render the email, send it, then write a
 *      `compliance_reminders` row to mark this bucket fired.
 *      A unique index on (item, channel, days_before) makes the whole pipeline
 *      idempotent — a partial failure can be re-run safely.
 *
 * This function uses the service-role client so it bypasses RLS. It's only
 * ever called from `/api/cron/compliance-reminders`, which authenticates
 * with `CRON_SECRET`.
 */
export type SendRemindersResult = {
  /** Rows whose `status` column was refreshed this tick (crossed a threshold). */
  statusesRefreshed: number;
  found: number;
  sent: number;
  skipped: number;
  failed: number;
  /** Total in-app notification rows written across all due items. */
  inAppPublished: number;
  details: Array<{
    itemId: string;
    type: ComplianceType;
    daysBefore: number;
    status: 'sent' | 'skipped' | 'failed';
    error?: string;
  }>;
};

type DueReminderRow = {
  item_id: string;
  org_id: string;
  property_id: string | null;
  type: ComplianceType;
  expires_at: string;
  days_before: number;
  recipient_email: string;
  org_name: string;
  property_name: string | null;
};

export async function sendComplianceReminders(): Promise<SendRemindersResult> {
  const log = getLogger().child({ module: 'compliance.cron' });
  const supabase = createServiceClient();
  const buckets = reminderBuckets();

  // Step 0 — refresh `compliance_items.status` for rows that crossed a
  // threshold (ok → due_soon → overdue) purely because the calendar moved.
  // The trigger handles writes; this RPC handles "no UPDATE happened, but
  // today is the day". Cheap: only writes rows whose status actually changed.
  let statusesRefreshed = 0;
  {
    const { data: refreshed, error: refreshErr } = await supabase.rpc(
      'refresh_compliance_statuses',
    );
    if (refreshErr) {
      // Don't fail the whole cron if status refresh fails — log and continue.
      // Reminders read off `expires_at` directly so they still fire correctly.
      log.error({ err: refreshErr }, 'refresh_compliance_statuses rpc failed');
    } else {
      statusesRefreshed = typeof refreshed === 'number' ? refreshed : 0;
      log.info({ statusesRefreshed }, 'compliance statuses refreshed');
    }
  }

  const { data, error } = await supabase.rpc('due_compliance_reminders', {
    p_buckets: buckets,
  });
  if (error) {
    log.error({ err: error }, 'due_compliance_reminders rpc failed');
    throw error;
  }

  const due = (data ?? []) as DueReminderRow[];
  log.info({ buckets, count: due.length }, 'compliance reminders due');

  // Pre-load org members so the in-app fan-out is a single round-trip per org.
  const orgIds = Array.from(new Set(due.map((r) => r.org_id)));
  const orgMembers = new Map<string, string[]>();
  if (orgIds.length > 0) {
    const { data: members, error: memErr } = await supabase
      .from('org_memberships')
      .select('org_id, user_id, role')
      .in('org_id', orgIds)
      .is('revoked_at', null);
    if (memErr) {
      log.warn({ err: memErr }, 'org_memberships lookup failed; in-app fan-out skipped');
    } else {
      for (const m of members ?? []) {
        if (!['owner', 'agent', 'staff'].includes(m.role as string)) continue;
        const list = orgMembers.get(m.org_id as string) ?? [];
        list.push(m.user_id as string);
        orgMembers.set(m.org_id as string, list);
      }
    }
  }

  const result: SendRemindersResult = {
    statusesRefreshed,
    found: due.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    inAppPublished: 0,
    details: [],
  };

  for (const row of due) {
    const dashboardUrl = `${publicEnv.NEXT_PUBLIC_SITE_URL}/landlord/compliance`;
    const isOverdue = row.days_before <= 0;
    const typeLabel = COMPLIANCE_RULES[row.type]?.label ?? row.type;

    // In-app fan-out — one row per org owner/agent/staff. Independent of the
    // email send; we want the bell to light up even if Resend is rate-limited.
    const memberIds = orgMembers.get(row.org_id) ?? [];
    for (const userId of memberIds) {
      const decision = await publishNotification({
        user_id: userId,
        kind: isOverdue ? 'compliance_overdue' : 'compliance_due',
        title: isOverdue
          ? `${typeLabel} — overdue`
          : `${typeLabel} — expires in ${row.days_before}d`,
        body: row.property_name
          ? `${row.property_name}: expires ${row.expires_at}.`
          : `Expires ${row.expires_at}.`,
        link_url: dashboardUrl,
        entity_type: 'compliance_item',
        entity_id: row.item_id,
        meta: {
          type: row.type,
          property_name: row.property_name,
          days_before: row.days_before,
          expires_at: row.expires_at,
        },
      });
      if (decision.notification_id) result.inAppPublished += 1;
    }

    const rendered = renderComplianceReminderEmail({
      recipientEmail: row.recipient_email,
      landlordOrgName: row.org_name,
      propertyName: row.property_name,
      type: row.type,
      expiresAt: row.expires_at,
      daysBefore: row.days_before,
      dashboardUrl,
    });

    const sent = await sendEmail({
      to: row.recipient_email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [
        { name: 'kind', value: 'compliance_reminder' },
        { name: 'type', value: row.type },
        { name: 'days_before', value: String(row.days_before) },
      ],
    });

    const status: 'sent' | 'failed' = sent.ok ? 'sent' : 'failed';
    const providerId = sent.ok ? sent.id : null;
    const errorMsg = sent.ok ? null : sent.error;

    const { error: ledgerErr } = await supabase.from('compliance_reminders').insert({
      org_id: row.org_id,
      compliance_item_id: row.item_id,
      days_before: row.days_before,
      channel: 'email',
      recipient: row.recipient_email,
      provider_id: providerId,
      status,
      error: errorMsg,
    });

    if (ledgerErr) {
      // 23505 = unique violation → another worker beat us; treat as skipped.
      if (ledgerErr.code === '23505') {
        result.skipped += 1;
        result.details.push({
          itemId: row.item_id,
          type: row.type,
          daysBefore: row.days_before,
          status: 'skipped',
          error: 'duplicate',
        });
        continue;
      }
      log.error({ err: ledgerErr, itemId: row.item_id }, 'failed to record reminder');
      result.failed += 1;
      result.details.push({
        itemId: row.item_id,
        type: row.type,
        daysBefore: row.days_before,
        status: 'failed',
        error: ledgerErr.message,
      });
      continue;
    }

    if (sent.ok) {
      result.sent += 1;
      result.details.push({
        itemId: row.item_id,
        type: row.type,
        daysBefore: row.days_before,
        status: 'sent',
      });
    } else {
      result.failed += 1;
      result.details.push({
        itemId: row.item_id,
        type: row.type,
        daysBefore: row.days_before,
        status: 'failed',
        error: sent.error,
      });
    }
  }

  log.info(
    {
      statusesRefreshed: result.statusesRefreshed,
      found: result.found,
      sent: result.sent,
      skipped: result.skipped,
      failed: result.failed,
      inAppPublished: result.inAppPublished,
    },
    'compliance reminders run complete',
  );
  return result;
}
