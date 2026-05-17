import { COMPLIANCE_RULES, type ComplianceType } from '@/core/constants/compliance';
import { baseLayout, ctaButton, escapeHtml, type RenderedEmail } from './_base';

/**
 * Compliance reminder email — sent by the daily cron when a certificate is
 * approaching expiry (or already overdue).
 *
 * Targeted at landlords. The tone shifts based on `daysBefore`:
 *   - 0   → URGENT — already expired today
 *   - <0  → "expired N days ago"
 *   - 7   → "expiring in 7 days"
 *   - 30+ → calmer, planning-style
 */
export type ComplianceReminderEmailInput = {
  recipientEmail: string;
  landlordOrgName: string;
  propertyName: string | null;
  type: ComplianceType;
  expiresAt: string;
  daysBefore: number;
  dashboardUrl: string;
};

export function renderComplianceReminderEmail(input: ComplianceReminderEmailInput): RenderedEmail {
  const rule = COMPLIANCE_RULES[input.type];
  const propertyLabel = input.propertyName ?? 'your property';
  const tone = toneFor(input.daysBefore);

  const subject = subjectFor(rule.label, propertyLabel, input.daysBefore);

  const text = [
    `Hi,`,
    ``,
    `${tone.lead} — your ${rule.label} for ${propertyLabel} ${tone.action} (${input.expiresAt}).`,
    ``,
    rule.description,
    ``,
    `Renew or upload a new certificate:`,
    input.dashboardUrl,
    ``,
    `— Tenantly compliance engine`,
  ].join('\n');

  const html = baseLayout({
    preheader: `${rule.label} for ${propertyLabel} ${tone.action} on ${input.expiresAt}.`,
    body: `
      <div style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;background:${tone.pillBg};color:${tone.pillFg};margin:0 0 12px;">
        ${escapeHtml(tone.pillLabel)}
      </div>
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 12px;color:#0b0b0d;">
        ${escapeHtml(rule.label)} ${escapeHtml(tone.action)}
      </h1>
      <p style="margin:0 0 16px;color:#444;">
        Hi ${escapeHtml(input.landlordOrgName)}, your <strong>${escapeHtml(rule.label)}</strong>
        for <strong>${escapeHtml(propertyLabel)}</strong>
        ${escapeHtml(tone.action)} on <strong>${escapeHtml(input.expiresAt)}</strong>.
      </p>
      <p style="margin:0 0 20px;color:#555;font-size:14px;">
        ${escapeHtml(rule.description)}
      </p>
      <p style="margin:0 0 24px;">
        ${ctaButton(input.dashboardUrl, 'Open compliance dashboard')}
      </p>
      <p style="margin:0;color:#999;font-size:12px;">
        You're receiving this because Tenantly tracks your HMO compliance.
        Update your reminder preferences in your org settings.
      </p>
    `,
  });

  return { subject, html, text };
}

type Tone = {
  lead: string;
  action: string;
  pillLabel: string;
  pillBg: string;
  pillFg: string;
};

function toneFor(daysBefore: number): Tone {
  if (daysBefore <= 0) {
    return {
      lead: 'Action required',
      action: 'has expired',
      pillLabel: 'Overdue',
      pillBg: '#fef2f2',
      pillFg: '#991b1b',
    };
  }
  if (daysBefore <= 7) {
    return {
      lead: 'Last call',
      action: 'expires this week',
      pillLabel: `${daysBefore} day${daysBefore === 1 ? '' : 's'} left`,
      pillBg: '#fff7ed',
      pillFg: '#9a3412',
    };
  }
  if (daysBefore <= 30) {
    return {
      lead: 'Heads up',
      action: `expires in ${daysBefore} days`,
      pillLabel: `Due in ${daysBefore} days`,
      pillBg: '#fffbeb',
      pillFg: '#854d0e',
    };
  }
  return {
    lead: 'Plan ahead',
    action: `expires in ${daysBefore} days`,
    pillLabel: `Due in ${daysBefore} days`,
    pillBg: '#eff6ff',
    pillFg: '#1d4ed8',
  };
}

function subjectFor(typeLabel: string, propertyLabel: string, daysBefore: number): string {
  if (daysBefore <= 0) return `[OVERDUE] ${typeLabel} expired — ${propertyLabel}`;
  if (daysBefore <= 7)
    return `[Action needed] ${typeLabel} expires in ${daysBefore} days — ${propertyLabel}`;
  return `${typeLabel} expires in ${daysBefore} days — ${propertyLabel}`;
}
