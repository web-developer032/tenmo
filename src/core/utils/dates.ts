import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { ComplianceStatus } from '../constants/compliance';

const TODAY = (): Date => new Date();

/** ISO date (`YYYY-MM-DD`) for a Date. */
export function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Parse `YYYY-MM-DD` safely; throws on bad input. */
export function fromIsoDate(value: string): Date {
  const d = parseISO(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return d;
}

/**
 * Compute compliance traffic-light status from an `expires_at` ISO date.
 *
 * - `expires_at < today`        → 'overdue'
 * - within 30 days of today     → 'due_soon'
 * - else                        → 'ok'
 * - null / undefined            → 'unknown'
 */
export function complianceStatus(
  expiresAt: string | null | undefined,
  now: Date = TODAY(),
): ComplianceStatus {
  if (!expiresAt) return 'unknown';
  const expiry = fromIsoDate(expiresAt);
  const days = differenceInCalendarDays(expiry, now);
  if (days < 0) return 'overdue';
  if (days <= 30) return 'due_soon';
  return 'ok';
}

/** Generate the next reminder date for a given days-before-expiry list. */
export function nextReminderDate(
  expiresAt: string,
  reminderDaysBefore: number[],
  now: Date = TODAY(),
): Date | null {
  const expiry = fromIsoDate(expiresAt);
  const sorted = [...reminderDaysBefore].sort((a, b) => b - a);
  for (const days of sorted) {
    const trigger = addDays(expiry, -days);
    if (trigger > now) return trigger;
  }
  return null;
}

/** Days until a given ISO date — negative if past. Calendar-day based. */
export function daysUntil(iso: string, now: Date = TODAY()): number {
  return differenceInCalendarDays(fromIsoDate(iso), now);
}

/** Human-readable relative date label. */
export function humaniseDeadline(iso: string, now: Date = TODAY()): string {
  const days = daysUntil(iso, now);
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 30) return `Due in ${days} days`;
  if (days <= 60) return `Due in ${Math.round(days / 7)} weeks`;
  return `Due ${format(fromIsoDate(iso), 'd MMM yyyy')}`;
}

/**
 * Tenantly's UK-first default locale. Used by the formatters below so the
 * server (Node, defaults to `en-US`) and the browser (user's choice, often
 * `en-GB`) agree on the rendered string and React doesn't fire a hydration
 * mismatch warning. Callers that want a different locale can override the
 * argument; everything else gets a deterministic UK output.
 */
const DEFAULT_LOCALE = 'en-GB';

/**
 * 24-hour `HH:mm` (e.g. `"10:04"`). Used by message bubbles and inbox row
 * timestamps where we want the same string on both sides of hydration.
 */
export function formatTimeOfDay(iso: string, locale: string = DEFAULT_LOCALE): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Compact date label — `"03 May"` when same calendar year as `now`,
 * `"03 May 26"` otherwise. Fixed-locale (so server/client match).
 */
export function formatShortDate(
  iso: string,
  locale: string = DEFAULT_LOCALE,
  now: Date = TODAY(),
): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: dt.getFullYear() === now.getFullYear() ? undefined : '2-digit',
  });
}

/**
 * Day-separator label — e.g. `"Sun, 03 May"` (current year) or
 * `"Sun, 03 May 2025"` (prior years). Stable across server/client.
 */
export function formatDayLabel(
  iso: string,
  locale: string = DEFAULT_LOCALE,
  now: Date = TODAY(),
): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: dt.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

/**
 * Compact "x ago" label for activity timestamps (notifications, ticket
 * messages, audit log). Pure, locale-agnostic — keep it short so it fits
 * the bell dropdown.
 */
export function relativeTimeShort(iso: string, now: Date = TODAY()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) return 'just now';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return format(then, 'd MMM yyyy');
}
