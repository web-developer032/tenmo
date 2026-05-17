import { baseLayout, ctaButton, escapeHtml, type RenderedEmail } from './_base';

/**
 * Rent payment recorded — sent to a tenant when a landlord manually
 * records a payment (so the tenant has a confirmation in writing).
 */
export type RentPaymentRecordedEmailInput = {
  recipientEmail: string;
  tenantName: string | null;
  amountFormatted: string;
  paidOn: string;
  methodLabel: string;
  propertyName: string;
  roomName: string | null;
  ledgerUrl: string;
};

export function renderRentPaymentRecordedEmail(
  input: RentPaymentRecordedEmailInput,
): RenderedEmail {
  const where = input.roomName ? `${input.roomName} at ${input.propertyName}` : input.propertyName;
  const greeting = input.tenantName ? `Hi ${input.tenantName},` : 'Hi,';
  const subject = `Rent payment recorded — ${input.amountFormatted}`;

  const text = [
    greeting,
    '',
    `We've recorded a rent payment of ${input.amountFormatted} (${input.methodLabel}) on ${input.paidOn} for ${where}.`,
    '',
    'View your full ledger:',
    input.ledgerUrl,
    '',
    '— Tenantly',
  ].join('\n');

  const html = baseLayout({
    preheader: `Rent payment recorded — ${input.amountFormatted} (${input.methodLabel})`,
    body: `
      <div style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;background:#ecfdf5;color:#065f46;margin:0 0 12px;">
        Payment recorded
      </div>
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 12px;color:#0b0b0d;">
        ${escapeHtml(input.amountFormatted)} received
      </h1>
      <p style="margin:0 0 16px;color:#444;">
        ${escapeHtml(greeting)} we've recorded a rent payment of
        <strong>${escapeHtml(input.amountFormatted)}</strong>
        (${escapeHtml(input.methodLabel)}) on
        <strong>${escapeHtml(input.paidOn)}</strong>
        for <strong>${escapeHtml(where)}</strong>.
      </p>
      <p style="margin:0 0 24px;">
        ${ctaButton(input.ledgerUrl, 'View ledger')}
      </p>
      <p style="margin:0;color:#999;font-size:12px;">
        If you don't recognise this payment, please reply to this email
        and we'll investigate.
      </p>
    `,
  });

  return { subject, html, text };
}
