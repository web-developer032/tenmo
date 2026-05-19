import { TONE, type ToneName } from '@/components/ds/status-tone';
import type { TicketSeverity, TicketStatus } from '@/core/constants/tickets';

/**
 * Centralised UI display tokens for tickets — labels + a `ToneName` that
 * resolves to the shared HMOeez tone classes via `TONE`. Every surface
 * (badges, dots, summary cells) reads from here so colours stay aligned
 * across the app.
 */
export type DisplayToken = {
  label: string;
  toneName: ToneName;
  tone: string;
  dot: string;
};

function fromTone(label: string, toneName: ToneName): DisplayToken {
  return { label, toneName, tone: TONE[toneName].chip, dot: TONE[toneName].dot };
}

const STATUS: Record<TicketStatus, DisplayToken> = {
  open: fromTone('Open', 'blue'),
  triaged: fromTone('Triaged', 'blue'),
  in_progress: fromTone('In progress', 'amber'),
  awaiting_tenant: fromTone('Waiting on tenant', 'amber'),
  awaiting_contractor: fromTone('Waiting on contractor', 'amber'),
  resolved: fromTone('Resolved', 'forest'),
  closed: fromTone('Closed', 'neutral'),
  cancelled: fromTone('Cancelled', 'neutral'),
};

const SEVERITY: Record<TicketSeverity, DisplayToken> = {
  low: fromTone('Low', 'neutral'),
  medium: fromTone('Medium', 'blue'),
  high: fromTone('High', 'amber'),
  critical: fromTone('Critical', 'alert'),
};

export function ticketStatusDisplay(status: TicketStatus): DisplayToken {
  return STATUS[status] ?? STATUS.open;
}

export function ticketSeverityDisplay(severity: TicketSeverity): DisplayToken {
  return SEVERITY[severity] ?? SEVERITY.medium;
}
