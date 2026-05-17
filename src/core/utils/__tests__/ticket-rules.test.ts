import { describe, expect, it } from 'vitest';
import type { Ticket } from '@/core/schemas/ticket';
import {
  allowedNextStatuses,
  canTransition,
  compareTicketsForBoard,
  firstResponseSla,
  groupByStatus,
  isOpenStatus,
  isTerminalStatus,
  resolutionSla,
  summariseTickets,
  triageTicket,
} from '@/core/utils/ticket-rules';

const ticket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: '00000000-0000-0000-0000-000000000001',
  org_id: '00000000-0000-0000-0000-000000000010',
  property_id: '00000000-0000-0000-0000-000000000020',
  room_id: null,
  tenancy_id: '00000000-0000-0000-0000-000000000030',
  title: 'Boiler making banging noises',
  description: 'It started yesterday.',
  category: 'heating_hot_water',
  severity: 'high',
  status: 'open',
  assigned_to_user_id: null,
  assigned_contractor: null,
  first_response_at: null,
  resolved_at: null,
  closed_at: null,
  reopened_count: 0,
  ai_suggested_category: null,
  ai_suggested_severity: null,
  ai_triage_reason: null,
  created_by: '00000000-0000-0000-0000-000000000040',
  created_at: '2026-04-20T00:00:00Z',
  updated_at: '2026-04-20T00:00:00Z',
  ...overrides,
});

describe('status state machine', () => {
  it('lets a tenant cancel an open ticket but not move it forward', () => {
    expect(allowedNextStatuses('open', 'tenant')).toEqual(['cancelled']);
    expect(canTransition('open', 'cancelled', 'tenant')).toBe(true);
    expect(canTransition('open', 'in_progress', 'tenant')).toBe(false);
  });

  it('lets a landlord triage an open ticket', () => {
    expect(canTransition('open', 'triaged', 'landlord')).toBe(true);
    expect(canTransition('open', 'in_progress', 'landlord')).toBe(true);
    expect(canTransition('open', 'resolved', 'landlord')).toBe(true);
  });

  it('lets a tenant reopen a resolved ticket', () => {
    expect(canTransition('resolved', 'open', 'tenant')).toBe(true);
  });

  it('refuses any transition out of closed/cancelled', () => {
    for (const role of ['tenant', 'landlord'] as const) {
      expect(allowedNextStatuses('closed', role)).toEqual([]);
      expect(allowedNextStatuses('cancelled', role)).toEqual([]);
    }
  });

  it('classifies open vs terminal', () => {
    expect(isOpenStatus('open')).toBe(true);
    expect(isOpenStatus('triaged')).toBe(true);
    expect(isOpenStatus('closed')).toBe(false);
    expect(isOpenStatus('resolved')).toBe(false);
    expect(isTerminalStatus('closed')).toBe(true);
    expect(isTerminalStatus('cancelled')).toBe(true);
    expect(isTerminalStatus('open')).toBe(false);
  });
});

describe('SLA helpers', () => {
  it('returns null for terminal tickets', () => {
    expect(
      firstResponseSla(ticket({ status: 'closed' }), new Date('2026-04-21T00:00:00Z')),
    ).toBeNull();
    expect(
      resolutionSla(ticket({ status: 'cancelled' }), new Date('2026-04-21T00:00:00Z')),
    ).toBeNull();
  });

  it('returns null for first-response SLA once first_response_at is set', () => {
    expect(
      firstResponseSla(
        ticket({ first_response_at: '2026-04-20T01:00:00Z' }),
        new Date('2026-04-21T00:00:00Z'),
      ),
    ).toBeNull();
  });

  it('flags breached when elapsed > target', () => {
    const high = ticket({ severity: 'high' });
    // High severity = 8h target. 10h elapsed → breached.
    const sla = firstResponseSla(high, new Date('2026-04-20T10:00:00Z'));
    expect(sla?.level).toBe('breached');
    expect(sla?.remainingHours).toBeLessThan(0);
  });

  it('flags approaching at >=80% of target', () => {
    const high = ticket({ severity: 'high' });
    // 8h target, 7h elapsed = 87.5% → approaching.
    const sla = firstResponseSla(high, new Date('2026-04-20T07:00:00Z'));
    expect(sla?.level).toBe('approaching');
  });

  it('stays on_track well below the threshold', () => {
    const high = ticket({ severity: 'high' });
    const sla = firstResponseSla(high, new Date('2026-04-20T01:00:00Z'));
    expect(sla?.level).toBe('on_track');
  });
});

describe('AI triage stub', () => {
  it('classifies obvious heating issues', () => {
    const t = triageTicket({
      title: 'Boiler is making horrible noises',
      description: 'No hot water in the morning.',
    });
    expect(t.category).toBe('heating_hot_water');
    // "no hot water" is in CRITICAL_KEYWORDS → severity bumped to critical
    expect(t.severity).toBe('critical');
  });

  it('escalates security issues to critical via category default', () => {
    const t = triageTicket({
      title: 'Lock is broken',
      description: "Can't lock the front. Need a replacement key urgently.",
    });
    expect(t.category).toBe('security');
    expect(t.severity).toBe('critical');
  });

  it('falls back to "other" with low confidence on unmatched text', () => {
    const t = triageTicket({
      title: 'Question about the contract',
      description: 'Just curious about something.',
    });
    expect(t.category).toBe('other');
    expect(t.confidence).toBe('low');
  });

  it('detects damp/mould as high severity habitability risk', () => {
    const t = triageTicket({
      title: 'Mould and mildew in bathroom',
      description: 'Damp patch keeps growing.',
    });
    expect(t.category).toBe('damp_mould');
    expect(['high', 'critical']).toContain(t.severity);
  });

  it('is deterministic for the same input', () => {
    const a = triageTicket({ title: 'Leaking tap', description: 'Drips constantly.' });
    const b = triageTicket({ title: 'Leaking tap', description: 'Drips constantly.' });
    expect(a).toEqual(b);
  });
});

describe('sort + group helpers', () => {
  it('sorts critical first, then by creation time', () => {
    const a = ticket({ id: 'a', severity: 'low', created_at: '2026-04-19T00:00:00Z' });
    const b = ticket({ id: 'b', severity: 'critical', created_at: '2026-04-20T00:00:00Z' });
    const c = ticket({ id: 'c', severity: 'high', created_at: '2026-04-18T00:00:00Z' });
    const sorted = [a, b, c].sort(compareTicketsForBoard);
    expect(sorted.map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('sinks closed/cancelled to the bottom', () => {
    const a = ticket({ id: 'a', severity: 'critical', status: 'closed' });
    const b = ticket({ id: 'b', severity: 'low', status: 'open' });
    const sorted = [a, b].sort(compareTicketsForBoard);
    expect(sorted.map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('groups by status with empty buckets for missing ones', () => {
    const t = ticket({ status: 'in_progress' });
    const grouped = groupByStatus([t]);
    expect(grouped.in_progress).toHaveLength(1);
    expect(grouped.open).toHaveLength(0);
    expect(grouped.closed).toHaveLength(0);
  });
});

describe('summariseTickets', () => {
  it('counts opens, criticals, awaiting and recently resolved', () => {
    const now = new Date('2026-04-25T00:00:00Z');
    const tickets: Ticket[] = [
      ticket({ id: 'a', severity: 'critical', status: 'open' }),
      ticket({ id: 'b', severity: 'high', status: 'awaiting_tenant' }),
      ticket({ id: 'c', severity: 'low', status: 'awaiting_contractor' }),
      ticket({
        id: 'd',
        severity: 'medium',
        status: 'resolved',
        resolved_at: '2026-04-23T00:00:00Z',
      }),
      ticket({
        id: 'e',
        severity: 'low',
        status: 'closed',
        resolved_at: '2026-04-01T00:00:00Z',
      }),
    ];
    const stats = summariseTickets(tickets, now);
    expect(stats.total).toBe(5);
    expect(stats.openCount).toBe(3);
    expect(stats.criticalOpen).toBe(1);
    expect(stats.awaitingTenant).toBe(1);
    expect(stats.awaitingContractor).toBe(1);
    expect(stats.resolvedThisWeek).toBe(1);
  });
});
