import { baseLayout, ctaButton, escapeHtml, type RenderedEmail } from './_base';

/**
 * Compliance alert email — sent when a Tenantly admin proactively notifies
 * a landlord about a compliance violation that needs urgent attention
 * (Renters' Rights Bill / EPC / Gas Safety / HMO licence).
 */
export type ComplianceAlertEmailInput = {
  recipientEmail: string;
  orgName: string;
  /** A short summary of the violation kind (e.g. "Gas Safety expiring"). */
  kind: string;
  /** Optional free-text note added by the admin. */
  note: string | null;
  complianceUrl: string;
  /** Name of the Tenantly admin who triggered the notification. */
  contactedByName: string | null;
};

export function renderComplianceAlertEmail(input: ComplianceAlertEmailInput): RenderedEmail {
  const contactedBy = input.contactedByName ?? 'the Tenantly team';
  const subject = `Compliance attention required — ${input.kind}`;

  const text = [
    'Hi,',
    '',
    `${contactedBy} from Tenantly has flagged a compliance issue on your account "${input.orgName}":`,
    `  • ${input.kind}`,
    '',
    input.note ? `Note from the team: ${input.note}` : '',
    '',
    "We're letting you know proactively so you can resolve this before it becomes a tenancy risk. The Renters' Rights Bill enforces strict timelines on these — the sooner you resolve, the safer your tenancies.",
    '',
    'Review your compliance dashboard:',
    input.complianceUrl,
    '',
    '— Tenantly compliance team',
  ]
    .filter(Boolean)
    .join('\n');

  const html = baseLayout({
    preheader: `${contactedBy} flagged a compliance issue: ${input.kind}.`,
    body: `
      <div style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;background:#fef2f2;color:#991b1b;margin:0 0 12px;">
        Compliance attention required
      </div>
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 12px;color:#0b0b0d;">
        ${escapeHtml(input.kind)}
      </h1>
      <p style="margin:0 0 16px;color:#444;">
        <strong>${escapeHtml(contactedBy)}</strong> from the Tenantly compliance team has flagged
        an issue on <strong>${escapeHtml(input.orgName)}</strong> that needs your attention.
      </p>
      ${
        input.note
          ? `<p style="margin:0 0 20px;padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;color:#9a3412;font-size:14px;">
              ${escapeHtml(input.note)}
            </p>`
          : ''
      }
      <p style="margin:0 0 20px;color:#555;font-size:14px;">
        We're letting you know proactively so you can resolve this before it becomes a tenancy
        risk. The Renters' Rights Bill enforces strict timelines on these — the sooner you
        resolve, the safer your tenancies.
      </p>
      <p style="margin:0 0 24px;">
        ${ctaButton(input.complianceUrl, 'Open compliance dashboard')}
      </p>
      <p style="margin:0;color:#999;font-size:12px;">
        Replies are not monitored — for support email support@tenantly.app.
      </p>
    `,
  });

  return { subject, html, text };
}
