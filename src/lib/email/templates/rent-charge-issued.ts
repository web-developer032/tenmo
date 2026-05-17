import { baseLayout, ctaButton, escapeHtml, type RenderedEmail } from './_base';

/**
 * Rent charge issued — sent to a tenant when a new rent_charge has been
 * created (e.g. by the monthly cron). Friendly, calm tone; never demanding.
 *
 * The tenant is *never* charged a platform fee — face-value rent only.
 */
export type RentChargeIssuedEmailInput = {
  recipientEmail: string;
  tenantName: string | null;
  propertyName: string;
  roomName: string | null;
  amountFormatted: string;
  dueDate: string;
  ledgerUrl: string;
};

export function renderRentChargeIssuedEmail(input: RentChargeIssuedEmailInput): RenderedEmail {
  const where = input.roomName ? `${input.roomName} at ${input.propertyName}` : input.propertyName;
  const greeting = input.tenantName ? `Hi ${input.tenantName},` : 'Hi,';
  const subject = `Rent due ${input.dueDate} — ${where}`;

  const text = [
    greeting,
    '',
    `Your next rent payment of ${input.amountFormatted} for ${where} is due on ${input.dueDate}.`,
    '',
    'You can review your rent ledger and payment history any time:',
    input.ledgerUrl,
    '',
    'Tenantly never charges tenants a platform fee — you only pay rent.',
    '',
    '— Tenantly',
  ].join('\n');

  const html = baseLayout({
    preheader: `Rent ${input.amountFormatted} due ${input.dueDate} — ${where}`,
    body: `
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 12px;color:#0b0b0d;">
        Your next rent is due ${escapeHtml(input.dueDate)}
      </h1>
      <p style="margin:0 0 16px;color:#444;">
        ${escapeHtml(greeting)} your next rent payment of
        <strong>${escapeHtml(input.amountFormatted)}</strong>
        for <strong>${escapeHtml(where)}</strong> is due on
        <strong>${escapeHtml(input.dueDate)}</strong>.
      </p>
      <p style="margin:0 0 24px;">
        ${ctaButton(input.ledgerUrl, 'View your rent ledger')}
      </p>
      <p style="margin:0;color:#666;font-size:13px;">
        Tenantly is free for tenants — no platform fees, ever.
      </p>
    `,
  });

  return { subject, html, text };
}
