import { formatMoney } from '@/core/utils/money';
import { baseLayout, ctaButton, escapeHtml, type RenderedEmail } from './_base';

/**
 * Branded transactional email — tenancy invite.
 *
 * Important: Tenants are NEVER charged on Tenantly. This template explicitly
 * surfaces that fact ("free for you, forever") so the recipient knows what
 * they're signing up for.
 */
export type TenancyInviteEmailInput = {
  inviteUrl: string;
  recipientEmail: string;
  landlordOrgName: string;
  propertyName: string;
  propertyCity: string | null;
  roomName: string | null;
  rentPence: number;
  rentFrequency: 'monthly' | 'weekly';
  startDate: string;
  expiresAt: string | null;
};

export function renderTenancyInviteEmail(input: TenancyInviteEmailInput): RenderedEmail {
  const rent = `${formatMoney(input.rentPence)}${input.rentFrequency === 'weekly' ? ' / week' : ' / month'}`;
  const where = [input.propertyName, input.propertyCity].filter(Boolean).join(', ');
  const room = input.roomName ? ` (room: ${input.roomName})` : '';

  const subject = `You've been invited to ${input.propertyName} on Tenantly`;

  const text = [
    `Hi,`,
    ``,
    `${input.landlordOrgName} has invited you to a tenancy at ${where}${room}.`,
    `Rent: ${rent}.`,
    `Move-in: ${input.startDate}.`,
    ``,
    `Tenantly is free for tenants — forever. You'll never be charged a penny.`,
    ``,
    `Accept your invite:`,
    input.inviteUrl,
    ``,
    input.expiresAt ? `This invite expires on ${input.expiresAt}.` : '',
    ``,
    `If you weren't expecting this, just ignore this email.`,
    `— The Tenantly team`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = baseLayout({
    preheader: `${input.landlordOrgName} invited you to ${input.propertyName} — free for tenants forever.`,
    body: `
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;color:#0b0b0d;">
        You've been invited to a tenancy
      </h1>
      <p style="margin:0 0 12px;color:#444;">
        <strong>${escapeHtml(input.landlordOrgName)}</strong> has invited
        <strong>${escapeHtml(input.recipientEmail)}</strong> to:
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;width:100%;">
        <tr><td style="padding:8px 0;color:#666;width:120px;">Property</td><td style="padding:8px 0;color:#0b0b0d;"><strong>${escapeHtml(input.propertyName)}</strong></td></tr>
        ${input.propertyCity ? `<tr><td style="padding:8px 0;color:#666;">City</td><td style="padding:8px 0;color:#0b0b0d;">${escapeHtml(input.propertyCity)}</td></tr>` : ''}
        ${input.roomName ? `<tr><td style="padding:8px 0;color:#666;">Room</td><td style="padding:8px 0;color:#0b0b0d;">${escapeHtml(input.roomName)}</td></tr>` : ''}
        <tr><td style="padding:8px 0;color:#666;">Rent</td><td style="padding:8px 0;color:#0b0b0d;"><strong>${escapeHtml(rent)}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#666;">Move-in</td><td style="padding:8px 0;color:#0b0b0d;">${escapeHtml(input.startDate)}</td></tr>
      </table>
      <p style="margin:0 0 24px;padding:14px 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;color:#065f46;">
        Tenantly is <strong>free for tenants — forever.</strong> No fees, no card required.
      </p>
      <p style="margin:0 0 24px;">
        ${ctaButton(input.inviteUrl, 'Review and accept invite')}
      </p>
      ${input.expiresAt ? `<p style="margin:0 0 12px;color:#666;font-size:13px;">This invite expires on ${escapeHtml(input.expiresAt)}.</p>` : ''}
      <p style="margin:0;color:#999;font-size:13px;">
        If you weren't expecting this, you can safely ignore the email.
      </p>
    `,
  });

  return { subject, html, text };
}
