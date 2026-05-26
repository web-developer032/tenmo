import { baseLayout, ctaButton, escapeHtml, type RenderedEmail } from './_base';

/**
 * Billing card-update reminder email — sent by the admin "Send card reminder"
 * action and (in the future) by the dunning cron when the platform decides
 * Stripe's built-in dunning isn't enough.
 *
 * Audience: landlord (the org owner). Friendly but explicit about what will
 * happen if no action is taken.
 */
export type BillingReminderEmailInput = {
  recipientEmail: string;
  ownerName: string | null;
  orgName: string;
  /** Optional last 4 of the failed card; null when not available. */
  cardLast4: string | null;
  /** Pre-formatted amount string, e.g. "£49.00". null hides the line. */
  outstandingAmount: string | null;
  /** "Card declined", "Trial ending soon", etc. Drives the lead copy. */
  reason:
    | 'card_failed'
    | 'card_declined'
    | 'trial_ending'
    | 'past_due'
    | 'manual';
  /** Direct link to the Stripe billing portal (or the landlord billing page). */
  billingUrl: string;
};

export function renderBillingReminderEmail(input: BillingReminderEmailInput): RenderedEmail {
  const greeting = input.ownerName ? `Hi ${input.ownerName},` : 'Hi,';
  const reasonCopy = REASON_COPY[input.reason];
  const cardFragment = input.cardLast4 ? ` ending in ${input.cardLast4}` : '';
  const outstandingFragment = input.outstandingAmount
    ? `${input.outstandingAmount} is currently outstanding on your Tenantly subscription for ${input.orgName}. `
    : '';

  const subject = `${reasonCopy.subjectPrefix} — ${input.orgName}`;

  const text = [
    greeting,
    '',
    `${reasonCopy.lead}${cardFragment ? ` (card${cardFragment})` : ''}.`,
    '',
    `${outstandingFragment}${reasonCopy.body}`,
    '',
    'Update your billing details:',
    input.billingUrl,
    '',
    '— Tenantly billing',
  ].join('\n');

  const html = baseLayout({
    preheader: reasonCopy.preheader,
    body: `
      <div style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;background:${reasonCopy.pillBg};color:${reasonCopy.pillFg};margin:0 0 12px;">
        ${escapeHtml(reasonCopy.pillLabel)}
      </div>
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 12px;color:#0b0b0d;">
        ${escapeHtml(reasonCopy.headline)}
      </h1>
      <p style="margin:0 0 16px;color:#444;">
        ${escapeHtml(greeting)} ${escapeHtml(reasonCopy.lead)}${
          cardFragment ? ` <strong>(card${escapeHtml(cardFragment)})</strong>` : ''
        }.
      </p>
      ${
        input.outstandingAmount
          ? `<p style="margin:0 0 16px;color:#444;">
                <strong>${escapeHtml(input.outstandingAmount)}</strong> is currently outstanding for
                <strong>${escapeHtml(input.orgName)}</strong>.
              </p>`
          : ''
      }
      <p style="margin:0 0 20px;color:#555;font-size:14px;">
        ${escapeHtml(reasonCopy.body)}
      </p>
      <p style="margin:0 0 24px;">
        ${ctaButton(input.billingUrl, 'Update billing details')}
      </p>
      <p style="margin:0;color:#999;font-size:12px;">
        You're receiving this from the Tenantly billing system. Replies are not monitored — for
        billing support email billing@tenantly.app.
      </p>
    `,
  });

  return { subject, html, text };
}

type ReasonCopy = {
  subjectPrefix: string;
  preheader: string;
  pillLabel: string;
  pillBg: string;
  pillFg: string;
  headline: string;
  lead: string;
  body: string;
};

const REASON_COPY: Record<BillingReminderEmailInput['reason'], ReasonCopy> = {
  card_failed: {
    subjectPrefix: 'Action needed: your card just failed',
    preheader: 'Your card on file failed — please update to keep Tenantly running.',
    pillLabel: 'Card failed',
    pillBg: '#fef2f2',
    pillFg: '#991b1b',
    headline: 'Your last payment failed',
    lead: 'Your most recent Tenantly payment was declined',
    body: 'Update your card on file to keep your Tenantly subscription active and avoid service interruption.',
  },
  card_declined: {
    subjectPrefix: 'Action needed: card declined',
    preheader: "Your card was declined — let's get that sorted.",
    pillLabel: 'Card declined',
    pillBg: '#fef2f2',
    pillFg: '#991b1b',
    headline: 'Your card was declined',
    lead: "Tenantly couldn't take your latest subscription payment",
    body: 'Please update your card details so we can retry the payment. Your access to Tenantly stays unchanged for the next 7 days.',
  },
  trial_ending: {
    subjectPrefix: 'Your trial is ending soon',
    preheader: 'Add a payment method to continue with Tenantly after your trial.',
    pillLabel: 'Trial ending',
    pillBg: '#fff7ed',
    pillFg: '#9a3412',
    headline: 'Your free trial is almost over',
    lead: "We'd love to keep you on Tenantly",
    body: 'Add a payment method now to keep your tenancies, compliance reminders, and rent collection live when the trial ends.',
  },
  past_due: {
    subjectPrefix: 'Your account is past due',
    preheader: 'Update your payment method to clear the outstanding balance.',
    pillLabel: 'Past due',
    pillBg: '#fef2f2',
    pillFg: '#991b1b',
    headline: 'Your account is past due',
    lead: 'Your Tenantly subscription has unpaid invoices',
    body: 'Update your card to clear the balance — Tenantly will retry the payment automatically once the new card is saved.',
  },
  manual: {
    subjectPrefix: 'Quick billing reminder',
    preheader: 'A friendly nudge from the Tenantly team.',
    pillLabel: 'Reminder',
    pillBg: '#eff6ff',
    pillFg: '#1d4ed8',
    headline: 'A quick billing reminder',
    lead: 'The Tenantly team wanted to flag your account for an update',
    body: "If you've already updated your billing details you can ignore this — otherwise the link below opens your subscription portal.",
  },
};
