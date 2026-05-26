import { baseLayout, ctaButton, escapeHtml, type RenderedEmail } from './_base';

/**
 * Landlord invite email — sent when a Tenantly admin invites a new
 * landlord/agency owner to onboard onto the platform.
 *
 * The recipient signs up with the email this is sent to, and the
 * onboarding flow uses the suggested org name + slug we stash in the
 * admin audit log so they land at `/onboarding/create-org` with the
 * fields pre-filled.
 */
export type LandlordInviteEmailInput = {
  recipientEmail: string;
  orgName: string;
  tier: 'starter' | 'pro' | 'portfolio';
  invitedByName: string | null;
  signupUrl: string;
};

export function renderLandlordInviteEmail(input: LandlordInviteEmailInput): RenderedEmail {
  const inviter = input.invitedByName ?? 'the Tenantly team';
  const subject = `You're invited to onboard ${input.orgName} on Tenantly`;

  const text = [
    'Hi,',
    '',
    `${inviter} has invited you to onboard "${input.orgName}" onto Tenantly — the UK HMO management platform built around the Renters' Rights Bill.`,
    '',
    `Your account is pre-configured for the ${input.tier} plan. You'll be guided through creating your organisation, adding properties, and inviting your tenants.`,
    '',
    'Get started:',
    input.signupUrl,
    '',
    "If you weren't expecting this invite, you can ignore the email.",
    '',
    '— The Tenantly team',
  ].join('\n');

  const html = baseLayout({
    preheader: `${inviter} invited you to onboard ${input.orgName} on Tenantly.`,
    body: `
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;color:#0b0b0d;">
        You're invited to Tenantly
      </h1>
      <p style="margin:0 0 16px;color:#444;">
        <strong>${escapeHtml(inviter)}</strong> has invited you to onboard
        <strong>${escapeHtml(input.orgName)}</strong> onto Tenantly — the UK HMO
        management platform built around the Renters' Rights Bill.
      </p>
      <p style="margin:0 0 16px;color:#444;">
        Your account is pre-configured for the <strong>${escapeHtml(input.tier)}</strong> plan.
        You'll be guided through creating your organisation, adding properties, and inviting
        your tenants.
      </p>
      <p style="margin:0 0 24px;">
        ${ctaButton(input.signupUrl, 'Start onboarding')}
      </p>
      <p style="margin:0;color:#999;font-size:12px;">
        If you weren't expecting this invite you can safely ignore the email.
      </p>
    `,
  });

  return { subject, html, text };
}
