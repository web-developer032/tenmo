import { baseLayout, ctaButton, escapeHtml, type RenderedEmail } from './_base';

/**
 * Admin team invite email — sent when a super_admin invites a new admin
 * (support / finance / readonly) to the Tenantly admin console.
 *
 * The accept URL carries the invite token so the user can finalise their
 * account on first sign-in.
 */
export type AdminInviteEmailInput = {
  recipientEmail: string;
  role: 'super' | 'support' | 'finance' | 'readonly';
  invitedByName: string | null;
  acceptUrl: string;
  /** Optional ISO datetime when the invite expires. */
  expiresAt: string | null;
};

const ROLE_BLURB: Record<AdminInviteEmailInput['role'], string> = {
  super:
    'You have been given Super Admin access — the highest privilege level on Tenantly. You can manage other admins, impersonate landlords, and access every console feature.',
  support:
    "You have been given Support Admin access — you'll see all platform support tickets and can impersonate landlords to help debug their accounts.",
  finance:
    'You have been given Finance Admin access — you can manage subscriptions, retry failed Stripe invoices, and review platform billing.',
  readonly:
    'You have been given Read-only access — you can view all data on the admin console but cannot make changes.',
};

export function renderAdminInviteEmail(input: AdminInviteEmailInput): RenderedEmail {
  const inviter = input.invitedByName ?? 'the Tenantly team';
  const subject = `You're invited to the Tenantly admin console (${input.role})`;

  const text = [
    'Hi,',
    '',
    `${inviter} has invited you to the Tenantly admin console.`,
    '',
    ROLE_BLURB[input.role],
    '',
    'Accept your invite:',
    input.acceptUrl,
    '',
    input.expiresAt ? `This invite expires on ${input.expiresAt}.` : '',
    '',
    "If you weren't expecting this, please ignore the email — no account will be created without your sign-in.",
    '',
    '— Tenantly admin console',
  ]
    .filter(Boolean)
    .join('\n');

  const html = baseLayout({
    preheader: `${inviter} invited you to the Tenantly admin console as ${input.role}.`,
    body: `
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 12px;color:#0b0b0d;">
        You're invited to the Tenantly admin console
      </h1>
      <p style="margin:0 0 8px;color:#666;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;">
        Role · ${escapeHtml(input.role)}
      </p>
      <p style="margin:0 0 16px;color:#444;">
        <strong>${escapeHtml(inviter)}</strong> has invited you to the Tenantly admin console.
      </p>
      <p style="margin:0 0 20px;color:#444;">
        ${escapeHtml(ROLE_BLURB[input.role])}
      </p>
      <p style="margin:0 0 24px;">
        ${ctaButton(input.acceptUrl, 'Accept invite')}
      </p>
      ${
        input.expiresAt
          ? `<p style="margin:0 0 12px;color:#666;font-size:13px;">This invite expires on ${escapeHtml(input.expiresAt)}.</p>`
          : ''
      }
      <p style="margin:0;color:#999;font-size:12px;">
        If you weren't expecting this you can ignore the email — no admin account is created
        until you sign in via the link.
      </p>
    `,
  });

  return { subject, html, text };
}
