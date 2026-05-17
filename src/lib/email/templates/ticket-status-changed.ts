import { baseLayout, ctaButton, escapeHtml, type RenderedEmail } from './_base';

/**
 * Ticket status changed — sent to the tenant when the landlord side moves
 * a ticket between states (open → in_progress → resolved …) so they don't
 * have to check the app.
 */
export type TicketStatusChangedEmailInput = {
  recipientEmail: string;
  recipientName: string | null;
  propertyName: string;
  roomName: string | null;
  ticketTitle: string;
  fromStatusLabel: string;
  toStatusLabel: string;
  toStatusKey:
    | 'open'
    | 'triaged'
    | 'in_progress'
    | 'awaiting_tenant'
    | 'awaiting_contractor'
    | 'resolved'
    | 'closed'
    | 'cancelled';
  /** Optional human note from the actor. */
  note: string | null;
  ticketUrl: string;
};

const COPY: Record<
  TicketStatusChangedEmailInput['toStatusKey'],
  { headline: string; body: string }
> = {
  open: {
    headline: 'Ticket reopened',
    body: 'Your ticket has been reopened — the team will follow up.',
  },
  triaged: {
    headline: 'Ticket triaged',
    body: 'We’ve reviewed your request and triaged it. Work starts shortly.',
  },
  in_progress: {
    headline: 'Work has started',
    body: 'A team member is now working on this. You’ll get an update soon.',
  },
  awaiting_tenant: {
    headline: 'We need a quick reply',
    body: 'The team has a question for you — please open the ticket to respond.',
  },
  awaiting_contractor: {
    headline: 'Contractor scheduled',
    body: 'We’re waiting on a contractor — we’ll update you when work resumes.',
  },
  resolved: {
    headline: 'Marked as resolved',
    body: 'The team has marked this resolved. If it isn’t fixed, open the ticket and reopen it within 14 days.',
  },
  closed: {
    headline: 'Ticket closed',
    body: 'This ticket has been closed. Get in touch if anything changes.',
  },
  cancelled: {
    headline: 'Ticket cancelled',
    body: 'This ticket has been cancelled. If you raised it by mistake, open a new one any time.',
  },
};

export function renderTicketStatusChangedEmail(
  input: TicketStatusChangedEmailInput,
): RenderedEmail {
  const where = input.roomName ? `${input.roomName} · ${input.propertyName}` : input.propertyName;
  const greeting = input.recipientName ? `Hi ${input.recipientName},` : 'Hi,';
  const copy = COPY[input.toStatusKey];

  const subject = `${copy.headline} — ${input.ticketTitle}`;

  const noteBlock = input.note?.trim()
    ? `\n\nNote from your landlord:\n"${input.note.trim()}"`
    : '';

  const text = [
    greeting,
    '',
    `Status of "${input.ticketTitle}" (${where}) changed from ${input.fromStatusLabel} to ${input.toStatusLabel}.`,
    '',
    copy.body + noteBlock,
    '',
    'Open the ticket:',
    input.ticketUrl,
    '',
    '— Tenantly',
  ].join('\n');

  const html = baseLayout({
    preheader: `${input.fromStatusLabel} → ${input.toStatusLabel} on ${input.ticketTitle}`,
    body: `
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 8px;color:#0b0b0d;">
        ${escapeHtml(copy.headline)}
      </h1>
      <p style="margin:0 0 16px;color:#444;">
        ${escapeHtml(greeting)} the status of
        <strong>${escapeHtml(input.ticketTitle)}</strong>
        at <strong>${escapeHtml(where)}</strong> moved from
        <em>${escapeHtml(input.fromStatusLabel)}</em>
        to <strong>${escapeHtml(input.toStatusLabel)}</strong>.
      </p>
      <p style="margin:0 0 16px;color:#444;">${escapeHtml(copy.body)}</p>
      ${
        input.note?.trim()
          ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f7f7f8;border-left:3px solid #0b0b0d;border-radius:6px;margin:0 0 20px;">
              <tr><td style="padding:12px 14px;color:#0b0b0d;white-space:pre-wrap;">
                ${escapeHtml(input.note.trim())}
              </td></tr>
            </table>`
          : ''
      }
      <p style="margin:0 0 24px;">
        ${ctaButton(input.ticketUrl, 'View ticket')}
      </p>
    `,
  });

  return { subject, html, text };
}
