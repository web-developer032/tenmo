import type { ComplianceStatus, ComplianceType } from '@/core/constants/compliance';
import { COMPLIANCE_RULES } from '@/core/constants/compliance';

/**
 * Centralised display labels and tones for compliance items.
 * Shared by the dashboard, property page, and tenant view.
 */
export type ComplianceDisplay = {
  label: string;
  /** Tailwind class for a soft tinted badge. */
  tone: string;
  /** Tailwind class for a solid status dot, used in dense lists. */
  dot: string;
  /** Helper text shown to the user under the status. */
  helper: string;
};

const STATUS: Record<ComplianceStatus, ComplianceDisplay> = {
  ok: {
    label: 'In date',
    tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20',
    dot: 'bg-emerald-500',
    helper: 'Renewal not yet due.',
  },
  due_soon: {
    label: 'Due soon',
    tone: 'bg-amber-500/10 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/30',
    dot: 'bg-amber-500',
    helper: 'Expires within 30 days — book a renewal.',
  },
  overdue: {
    label: 'Overdue',
    tone: 'bg-red-500/10 text-red-700 dark:text-red-300 ring-1 ring-red-500/30',
    dot: 'bg-red-500',
    helper: 'Already expired — action required immediately.',
  },
  unknown: {
    label: 'Missing',
    tone: 'bg-muted text-muted-foreground ring-1 ring-border',
    dot: 'bg-zinc-400',
    helper: 'No certificate uploaded yet.',
  },
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
  if (score >= 90) return 'text-emerald-700 dark:text-emerald-300';
  if (score >= 70) return 'text-amber-700 dark:text-amber-300';
  return 'text-red-700 dark:text-red-300';
}
