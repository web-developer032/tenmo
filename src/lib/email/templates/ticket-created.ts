import { baseLayout, ctaButton, escapeHtml, type RenderedEmail } from './_base';

/**
 * Ticket created — sent to landlord(s) when a tenant raises a maintenance
 * ticket. Tenants do not get a confirmation email; they see the ticket
 * appear instantly in the in-app UI.
 *
 * Calm tone, severity-aware subject line.
 */
export type TicketCreatedEmailInput = {
  recipientEmail: string;
  recipientName: string | null;
  /** Person who raised the ticket (tenant or staff). */
  raisedByName: string | null;
  propertyName: string;
  roomName: string | null;
  ticketTitle: string;
  ticketDescription: string;
  severityLabel: string;
  severityKey: 'low' | 'medium' | 'high' | 'critical';
  categoryLabel: string;
  ticketUrl: string;
};

const SEVERITY_PREFIX: Record<TicketCreatedEmailInput['severityKey'], string> = {
  critical: '[CRITICAL] ',
  high: '[High] ',
  medium: '',
  low: '',
};

const SEVERITY_BG: Record<TicketCreatedEmailInput['severityKey'], string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#0ea5e9',
  low: '#64748b',
};

export function renderTicketCreatedEmail(input: TicketCreatedEmailInput): RenderedEmail {
  const where = input.roomName ? `${input.roomName} · ${input.propertyName}` : input.propertyName;
  const greeting = input.recipientName ? `Hi ${input.recipientName},` : 'Hi,';
  const raisedBy = input.raisedByName ?? 'A tenant';

  const subject =
    `${SEVERITY_PREFIX[input.severityKey]}New maintenance request — ${input.ticketTitle}`.trim();

  const text = [
    greeting,
    '',
    `${raisedBy} raised a new maintenance request for ${where}.`,
    '',
    `Title: ${input.ticketTitle}`,
    `Severity: ${input.severityLabel}`,
    `Category: ${input.categoryLabel}`,
    '',
    'Description:',
    input.ticketDescription,
    '',
    'Open it in Tenantly:',
    input.ticketUrl,
    '',
    '— Tenantly',
  ].join('\n');

  const html = baseLayout({
    preheader: `${raisedBy} raised: ${input.ticketTitle}`,
    body: `
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 8px;color:#0b0b0d;">
        New maintenance request
      </h1>
      <p style="margin:0 0 20px;color:#444;">
        ${escapeHtml(greeting)} ${escapeHtml(raisedBy)} raised a request for
        <strong>${escapeHtml(where)}</strong>.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f7f7f8;border-radius:8px;margin:0 0 20px;">
        <tr><td style="padding:14px 16px;">
          <div style="display:inline-block;background:${SEVERITY_BG[input.severityKey]};color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;padding:3px 8px;border-radius:999px;font-weight:600;">
            ${escapeHtml(input.severityLabel)}
          </div>
          <span style="color:#666;font-size:13px;margin-left:8px;">${escapeHtml(input.categoryLabel)}</span>
          <h2 style="margin:8px 0 4px;font-size:16px;color:#0b0b0d;">
            ${escapeHtml(input.ticketTitle)}
          </h2>
          <p style="margin:0;color:#444;white-space:pre-wrap;">${escapeHtml(input.ticketDescription)}</p>
        </td></tr>
      </table>
      <p style="margin:0 0 24px;">
        ${ctaButton(input.ticketUrl, 'View ticket')}
      </p>
      <p style="margin:0;color:#666;font-size:13px;">
        SLA timers start now. Reply in-app to acknowledge — your tenant sees it instantly.
      </p>
    `,
  });

  return { subject, html, text };
}
