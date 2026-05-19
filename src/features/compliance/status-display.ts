import { TONE, type ToneName } from '@/components/ds/status-tone';
import type { ComplianceStatus, ComplianceType } from '@/core/constants/compliance';
import { COMPLIANCE_RULES } from '@/core/constants/compliance';

/**
 * Centralised display labels and tones for compliance items.
 * Shared by the dashboard, property page, and tenant view.
 */
export type ComplianceDisplay = {
  label: string;
  toneName: ToneName;
  /** Tailwind class for a soft tinted badge. */
  tone: string;
  /** Tailwind class for a solid status dot, used in dense lists. */
  dot: string;
  /** Helper text shown to the user under the status. */
  helper: string;
};

function row(label: string, toneName: ToneName, helper: string): ComplianceDisplay {
  return { label, toneName, tone: TONE[toneName].chip, dot: TONE[toneName].dot, helper };
}

const STATUS: Record<ComplianceStatus, ComplianceDisplay> = {
  ok: row('In date', 'forest', 'Renewal not yet due.'),
  due_soon: row('Due soon', 'amber', 'Expires within 30 days — book a renewal.'),
  overdue: row('Overdue', 'alert', 'Already expired — action required immediately.'),
  unknown: row('Missing', 'neutral', 'No certificate uploaded yet.'),
};

export function complianceStatusDisplay(status: ComplianceStatus): ComplianceDisplay {
  return STATUS[status] ?? STATUS.unknown;
}

export function complianceTypeLabel(type: ComplianceType): string {
  return COMPLIANCE_RULES[type]?.label ?? type;
}

/**
 * Pick a tone for an org/property compliance score (0..100), shown in
 * the dashboard hero card.
 */
export function scoreTone(score: number): string {
  if (score >= 90) return TONE.forest.text;
  if (score >= 70) return TONE.amber.text;
  return TONE.alert.text;
}

export function scoreToneName(score: number): ToneName {
  if (score >= 90) return 'forest';
  if (score >= 70) return 'amber';
  return 'alert';
}
