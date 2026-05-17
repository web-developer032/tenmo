import { baseLayout, ctaButton, escapeHtml, type RenderedEmail } from './_base';

/**
 * Ticket message received — sent when a counterparty (landlord ↔ tenant)
 * posts a comment. Skipped if the recipient is the author.
 */
export type TicketMessageReceivedEmailInput = {
  recipientEmail: string;
  recipientName: string | null;
  authorName: string;
  /** Whether the author is on the landlord side or the tenant side. */
  authorRole: 'landlord' | 'tenant';
  propertyName: string;
  roomName: string | null;
  ticketTitle: string;
  messagePreview: string;
  ticketUrl: string;
};

export function renderTicketMessageReceivedEmail(
  input: TicketMessageReceivedEmailInput,
): RenderedEmail {
  const where = input.roomName ? `${input.roomName} · ${input.propertyName}` : input.propertyName;
  const greeting = input.recipientName ? `Hi ${input.recipientName},` : 'Hi,';
  const subject = `New reply — ${input.ticketTitle}`;

  const text = [
    greeting,
    '',
    `${input.authorName} replied on ${where}:`,
    '',
    truncate(input.messagePreview, 600),
    '',
    'Read and reply in Tenantly:',
    input.ticketUrl,
    '',
    '— Tenantly',
  ].join('\n');

  const html = baseLayout({
    preheader: `${input.authorName}: ${truncate(input.messagePreview, 80)}`,
    body: `
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 8px;color:#0b0b0d;">
        New reply on your ticket
      </h1>
      <p style="margin:0 0 16px;color:#444;">
        ${escapeHtml(greeting)} <strong>${escapeHtml(input.authorName)}</strong>
        replied on <strong>${escapeHtml(input.ticketTitle)}</strong>
        (${escapeHtml(where)}).
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f7f7f8;border-left:3px solid #0b0b0d;border-radius:6px;margin:0 0 20px;">
        <tr><td style="padding:14px 16px;color:#0b0b0d;white-space:pre-wrap;">
          ${escapeHtml(truncate(input.messagePreview, 600))}
        </td></tr>
      </table>
      <p style="margin:0 0 24px;">
        ${ctaButton(input.ticketUrl, 'Open ticket')}
      </p>
    `,
  });

  return { subject, html, text };
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}
