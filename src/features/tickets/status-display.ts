import type { TicketSeverity, TicketStatus } from '@/core/constants/tickets';

/**
 * Centralised UI display tokens for tickets — colours, labels, helpers.
 * Keep every UI surface aligned by reading from here.
 */
export type DisplayToken = {
  label: string;
  tone: string;
  dot: string;
};

const STATUS: Record<TicketStatus, DisplayToken> = {
  open: {
    label: 'Open',
    tone: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20',
    dot: 'bg-blue-500',
  },
  triaged: {
    label: 'Triaged',
    tone: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20',
    dot: 'bg-violet-500',
  },
  in_progress: {
    label: 'In progress',
    tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/20',
    dot: 'bg-sky-500',
  },
  awaiting_tenant: {
    label: 'Waiting on tenant',
    tone: 'bg-amber-500/10 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/30',
    dot: 'bg-amber-500',
  },
  awaiting_contractor: {
    label: 'Waiting on contractor',
    tone: 'bg-amber-500/10 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/30',
    dot: 'bg-amber-500',
  },
  resolved: {
    label: 'Resolved',
    tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  closed: {
    label: 'Closed',
    tone: 'bg-muted text-muted-foreground ring-1 ring-border',
    dot: 'bg-zinc-400',
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'bg-muted text-muted-foreground ring-1 ring-border',
    dot: 'bg-zinc-400',
  },
};

const SEVERITY: Record<TicketSeverity, DisplayToken> = {
  low: {
    label: 'Low',
    tone: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 ring-1 ring-slate-500/20',
    dot: 'bg-slate-500',
  },
  medium: {
    label: 'Medium',
    tone: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20',
    dot: 'bg-blue-500',
  },
  high: {
    label: 'High',
    tone: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500/30',
    dot: 'bg-orange-500',
  },
  critical: {
    label: 'Critical',
    tone: 'bg-red-500/10 text-red-700 dark:text-red-300 ring-1 ring-red-500/30',
    dot: 'bg-red-500',
  },
};

export function ticketStatusDisplay(status: TicketStatus): DisplayToken {
  return STATUS[status] ?? STATUS.open;
}

export function ticketSeverityDisplay(severity: TicketSeverity): DisplayToken {
  return SEVERITY[severity] ?? SEVERITY.medium;
}
