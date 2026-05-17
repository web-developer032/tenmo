import { getServerEnv } from '@/lib/env.server';
import { getLogger } from '@/lib/logger';

/**
 * Tenantly email client — server-only.
 *
 * Provider: Resend (https://resend.com). Cheap, transactional, EU region.
 * In dev (no `RESEND_API_KEY`) we log the message to console so the invite
 * flow is fully demoable without external services.
 *
 * Keep this module thin and DON'T import templates here — templates live in
 * `lib/email/templates/*.ts` and are passed in by the caller.
 */
export type EmailMessage = {
  to: string | string[];
  subject: string;
  /** Pre-rendered HTML body. */
  html: string;
  /** Plain-text fallback (recommended for deliverability). */
  text: string;
  /** Optional reply-to override. */
  replyTo?: string;
  /** Tags propagated to Resend webhooks (e.g. for analytics). */
  tags?: { name: string; value: string }[];
};

export type SendEmailResult =
  | { ok: true; provider: 'resend' | 'console'; id: string | null }
  | { ok: false; error: string };

/**
 * Send a single transactional email.
 *
 * Returns a result envelope rather than throwing — the caller decides whether
 * a missing email is fatal (e.g. for an invite that was actually persisted in
 * the database, the row is the source of truth, not the email).
 */
export async function sendEmail(message: EmailMessage): Promise<SendEmailResult> {
  const env = getServerEnv();
  const log = getLogger().child({ module: 'email' });

  const from = env.RESEND_FROM_EMAIL ?? 'Tenantly <onboarding@resend.dev>';

  if (!env.RESEND_API_KEY) {
    log.info(
      {
        to: message.to,
        subject: message.subject,
        textPreview: message.text.slice(0, 240),
      },
      'email/console (no RESEND_API_KEY set)',
    );
    return { ok: true, provider: 'console', id: null };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
        tags: message.tags,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      log.error({ status: res.status, detail }, 'resend send failed');
      return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 200)}` };
    }

    const json = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, provider: 'resend', id: json?.id ?? null };
  } catch (err) {
    log.error({ err }, 'resend send threw');
    return { ok: false, error: err instanceof Error ? err.message : 'unknown error' };
  }
}
