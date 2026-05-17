import { ADMIN_LIST_MAX_PAGE_SIZE, ADMIN_LIST_PAGE_SIZE } from '../constants/admin';

/**
 * Pure helpers for admin list pagination + search.
 *
 * Kept separate from the Zod schema (which validates the wire
 * shape) so the math is unit-testable without pulling in zod or
 * the rest of the request layer.
 */

export interface PaginationRange {
  /** 1-indexed page (clamped to ≥1). */
  page: number;
  /** Page size (clamped to 1..ADMIN_LIST_MAX_PAGE_SIZE). */
  perPage: number;
  /** 0-indexed inclusive start (Supabase `.range(start, end)`). */
  rangeStart: number;
  /** 0-indexed inclusive end. */
  rangeEnd: number;
}

export function computePaginationRange(
  page: number | undefined,
  perPage: number | undefined,
): PaginationRange {
  const clampedPage = Math.max(1, Math.floor(page ?? 1));
  const clampedPerPage = Math.min(
    ADMIN_LIST_MAX_PAGE_SIZE,
    Math.max(1, Math.floor(perPage ?? ADMIN_LIST_PAGE_SIZE)),
  );
  const rangeStart = (clampedPage - 1) * clampedPerPage;
  const rangeEnd = rangeStart + clampedPerPage - 1;
  return { page: clampedPage, perPage: clampedPerPage, rangeStart, rangeEnd };
}

/**
 * Normalise a free-text admin search query into a Postgres
 * `ILIKE` pattern. We:
 *   - trim whitespace
 *   - escape the SQL wildcards `%` and `_` so a user typing them
 *     literally finds those characters, not a wildcard match
 *   - wrap with `%...%` for substring search
 *
 * Returns `null` for empty/whitespace queries (caller skips the
 * filter).
 */
export function buildIlikePattern(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  // Escape the postgres LIKE metacharacters. Backslash is the
  // default escape so we don't need a custom ESCAPE clause.
  const escaped = trimmed.replace(/[\\%_]/g, (m) => `\\${m}`);
  return `%${escaped}%`;
}

/** Total page count for a row count + page size. */
export function totalPages(totalRows: number, perPage: number): number {
  if (perPage <= 0) return 0;
  return Math.max(1, Math.ceil(Math.max(0, totalRows) / perPage));
}
