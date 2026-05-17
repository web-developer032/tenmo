/**
 * Maintenance ticket — pure business logic.
 *
 * Lives in `core/utils/` so it's shared between server (API routes,
 * background jobs, mailers) and client (form validation, list ordering,
 * SLA badges). No Next.js, no DOM, no Supabase imports here — just data.
 */

import {
  TICKET_CATEGORY_RULES,
  TICKET_OPEN_STATUSES,
  TICKET_SEVERITY_RULES,
  TICKET_TERMINAL_STATUSES,
  type TicketCategory,
  type TicketSeverity,
  type TicketStatus,
} from '../constants/tickets';
import type { Ticket } from '../schemas/ticket';

// ============================================================================
// Status state machine
// ============================================================================

/**
 * Allowed status transitions, scoped by the role making the change. Keep this
 * conservative — the database enforces the column type but app code decides
 * which actor can request which transition.
 */
const TRANSITIONS_BY_ROLE: Record<'tenant' | 'landlord', Record<TicketStatus, TicketStatus[]>> = {
  tenant: {
    open: ['cancelled'],
    triaged: ['cancelled'],
    in_progress: ['cancelled'],
    awaiting_tenant: ['in_progress', 'cancelled'],
    awaiting_contractor: ['cancelled'],
    resolved: ['open'],
    closed: [],
    cancelled: [],
  },
  landlord: {
    open: [
      'triaged',
      'in_progress',
      'awaiting_tenant',
      'awaiting_contractor',
      'resolved',
      'cancelled',
    ],
    triaged: ['in_progress', 'awaiting_tenant', 'awaiting_contractor', 'resolved', 'cancelled'],
    in_progress: ['awaiting_tenant', 'awaiting_contractor', 'resolved', 'cancelled'],
    awaiting_tenant: ['in_progress', 'resolved', 'cancelled'],
    awaiting_contractor: ['in_progress', 'resolved', 'cancelled'],
    resolved: ['closed', 'in_progress'],
    closed: [],
    cancelled: [],
  },
};

export type TicketActorRole = 'tenant' | 'landlord';

export function allowedNextStatuses(current: TicketStatus, role: TicketActorRole): TicketStatus[] {
  return TRANSITIONS_BY_ROLE[role][current] ?? [];
}

export function canTransition(
  from: TicketStatus,
  to: TicketStatus,
  role: TicketActorRole,
): boolean {
  return allowedNextStatuses(from, role).includes(to);
}

export function isOpenStatus(status: TicketStatus): boolean {
  return (TICKET_OPEN_STATUSES as TicketStatus[]).includes(status);
}

export function isTerminalStatus(status: TicketStatus): boolean {
  return (TICKET_TERMINAL_STATUSES as TicketStatus[]).includes(status);
}

// ============================================================================
// SLA helpers
// ============================================================================

export type SlaBreachLevel = 'on_track' | 'approaching' | 'breached';

export type SlaSnapshot = {
  /** Hours since the relevant clock started. */
  elapsedHours: number;
  /** Hours allowed before the SLA breaches. */
  targetHours: number;
  /** Hours remaining (may be negative when breached). */
  remainingHours: number;
  /** Severity of the breach for UI colouring. */
  level: SlaBreachLevel;
};

const APPROACHING_THRESHOLD = 0.8; // 80% of the target → amber

/**
 * SLA for first response. Clock starts at ticket creation; stops when the
 * landlord (or anyone non-tenant) replies. Returns null if already
 * acknowledged or terminally closed.
 */
export function firstResponseSla(ticket: Ticket, now: Date = new Date()): SlaSnapshot | null {
  if (isTerminalStatus(ticket.status)) return null;
  if (ticket.first_response_at) return null;

  const targetHours = TICKET_SEVERITY_RULES[ticket.severity].firstResponseHours;
  const elapsedHours = hoursBetween(new Date(ticket.created_at), now);
  return slaSnapshot(elapsedHours, targetHours);
}

/**
 * SLA for resolution. Clock starts at ticket creation; stops when resolved.
 */
export function resolutionSla(ticket: Ticket, now: Date = new Date()): SlaSnapshot | null {
  if (isTerminalStatus(ticket.status) || ticket.status === 'resolved') return null;

  const targetHours = TICKET_SEVERITY_RULES[ticket.severity].resolutionHours;
  const elapsedHours = hoursBetween(new Date(ticket.created_at), now);
  return slaSnapshot(elapsedHours, targetHours);
}

function slaSnapshot(elapsedHours: number, targetHours: number): SlaSnapshot {
  const remainingHours = targetHours - elapsedHours;
  let level: SlaBreachLevel;
  if (remainingHours < 0) level = 'breached';
  else if (elapsedHours >= targetHours * APPROACHING_THRESHOLD) level = 'approaching';
  else level = 'on_track';

  return { elapsedHours, targetHours, remainingHours, level };
}

function hoursBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 36e5);
}

// ============================================================================
// Sort + group helpers
// ============================================================================

const SEVERITY_ORDER: Record<TicketSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Sort key for the kanban: critical first, then oldest first within severity.
 * Closed/cancelled tickets sink to the bottom.
 */
export function compareTicketsForBoard<
  T extends Pick<Ticket, 'status' | 'severity' | 'created_at'>,
>(a: T, b: T): number {
  const aTerm = isTerminalStatus(a.status) ? 1 : 0;
  const bTerm = isTerminalStatus(b.status) ? 1 : 0;
  if (aTerm !== bTerm) return aTerm - bTerm;

  const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  if (sev !== 0) return sev;

  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export type TicketsByStatus<T extends Pick<Ticket, 'status'> = Ticket> = Record<TicketStatus, T[]>;

export function groupByStatus<T extends Pick<Ticket, 'status'>>(tickets: T[]): TicketsByStatus<T> {
  const out: TicketsByStatus<T> = {
    open: [],
    triaged: [],
    in_progress: [],
    awaiting_tenant: [],
    awaiting_contractor: [],
    resolved: [],
    closed: [],
    cancelled: [],
  };
  for (const t of tickets) {
    out[t.status].push(t);
  }
  return out;
}

// ============================================================================
// AI triage stub
//
// This is a deterministic keyword-based heuristic. Same input → same output,
// no network calls, runs in any environment. Wire a real LLM later by
// implementing an adapter with the same signature and gating it on a feature
// flag — the public function name and shape stays the same.
// ============================================================================

export type TriageSuggestion = {
  category: TicketCategory;
  severity: TicketSeverity;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
};

const CRITICAL_KEYWORDS = [
  'gas smell',
  'gas leak',
  'fire',
  'flood',
  'flooding',
  'electric shock',
  'sparking',
  'no heating',
  'no hot water',
  'broken in',
  'break-in',
  "can't get in",
  "can't lock",
];

const HIGH_KEYWORDS = ['leak', 'mould', 'damp', 'pest', 'rats', 'mice', 'broken', 'unsafe'];

export function triageTicket(input: { title: string; description: string }): TriageSuggestion {
  const haystack = `${input.title} ${input.description}`.toLowerCase();

  // Pass 1: pick the category with the highest keyword match score.
  let bestCategory: TicketCategory = 'other';
  let bestScore = 0;
  for (const rule of Object.values(TICKET_CATEGORY_RULES)) {
    if (rule.type === 'other') continue;
    let score = 0;
    for (const kw of rule.keywords) {
      if (haystack.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = rule.type;
    }
  }

  // Pass 2: severity. Hard escalation for critical keywords; otherwise inherit
  // from the category default and bump for "high" keywords.
  let severity = TICKET_CATEGORY_RULES[bestCategory].defaultSeverity;
  let bumpReason = '';

  for (const kw of CRITICAL_KEYWORDS) {
    if (haystack.includes(kw)) {
      severity = 'critical';
      bumpReason = `Detected critical keyword: "${kw}".`;
      break;
    }
  }
  if (severity !== 'critical') {
    for (const kw of HIGH_KEYWORDS) {
      if (haystack.includes(kw)) {
        if (severity === 'low' || severity === 'medium') {
          severity = severityMax(severity, 'high');
          bumpReason = `Detected high-priority keyword: "${kw}".`;
        }
        break;
      }
    }
  }

  const confidence: TriageSuggestion['confidence'] =
    bestScore >= 2 ? 'high' : bestScore === 1 ? 'medium' : 'low';
  const reasonPieces = [
    `Category: ${TICKET_CATEGORY_RULES[bestCategory].label.toLowerCase()} (${bestScore} keyword hit${bestScore === 1 ? '' : 's'}).`,
  ];
  if (bumpReason) reasonPieces.push(bumpReason);

  return {
    category: bestCategory,
    severity,
    reason: reasonPieces.join(' '),
    confidence,
  };
}

function severityMax(a: TicketSeverity, b: TicketSeverity): TicketSeverity {
  return SEVERITY_ORDER[a] <= SEVERITY_ORDER[b] ? a : b;
}

// ============================================================================
// Stat helpers used by dashboards
// ============================================================================

export type TicketStats = {
  total: number;
  openCount: number;
  criticalOpen: number;
  awaitingTenant: number;
  awaitingContractor: number;
  resolvedThisWeek: number;
  breachedSla: number;
};

export function summariseTickets(tickets: Ticket[], now: Date = new Date()): TicketStats {
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

  let openCount = 0;
  let criticalOpen = 0;
  let awaitingTenant = 0;
  let awaitingContractor = 0;
  let resolvedThisWeek = 0;
  let breachedSla = 0;

  for (const t of tickets) {
    if (isOpenStatus(t.status)) {
      openCount += 1;
      if (t.severity === 'critical') criticalOpen += 1;
      if (t.status === 'awaiting_tenant') awaitingTenant += 1;
      if (t.status === 'awaiting_contractor') awaitingContractor += 1;
      const fr = firstResponseSla(t, now);
      const res = resolutionSla(t, now);
      if (fr?.level === 'breached' || res?.level === 'breached') breachedSla += 1;
    }
    if (t.resolved_at) {
      const resolvedAt = new Date(t.resolved_at).getTime();
      if (now.getTime() - resolvedAt <= oneWeekMs) resolvedThisWeek += 1;
    }
  }

  return {
    total: tickets.length,
    openCount,
    criticalOpen,
    awaitingTenant,
    awaitingContractor,
    resolvedThisWeek,
    breachedSla,
  };
}
