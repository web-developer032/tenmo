/**
 * Tenancy-chooser logic for the tenant rent + documents index pages.
 *
 * The pages live at /tenant/rent and /tenant/documents but the actual
 * data is keyed by tenancy. Most tenants only have one tenancy, so we
 * skip the picker and redirect straight to the detail page. When they
 * have two or more (or zero) we render a picker / empty state.
 *
 * This module is portable — no React, no DOM, no Next imports. The
 * actual `redirect()` call happens in the server component that
 * consumes the result.
 */

/** Minimal shape needed for the chooser. */
export interface ChoosableTenancy {
  id: string;
  status: string;
  start_date: string;
}

/**
 * Set of tenancy statuses that we consider "currently live enough" to
 * show in the rent/documents tenancy picker. Mirrors the active
 * statuses on the tenant dashboard (`ACTIVE_STATUSES`) but keeps
 * `ended` available so a recently-ended tenant can still grab their
 * paperwork.
 */
export const CHOOSABLE_TENANCY_STATUSES = [
  "pending_invite",
  "awaiting_signature",
  "awaiting_deposit",
  "active",
  "ended",
] as const;

/**
 * Result of {@link chooseTenancyTarget}.
 *
 *   - `kind: 'empty'`   — caller has no tenancies; render the empty state.
 *   - `kind: 'one'`     — caller has exactly one; redirect to `targetId`.
 *   - `kind: 'multi'`   — caller has two or more; render the picker with
 *                         the supplied `tenancies` (sorted by start_date
 *                         desc so the most recent appears first).
 */
export type TenancyChooserResult =
  | { kind: "empty" }
  | { kind: "one"; targetId: string }
  | { kind: "multi"; tenancies: ChoosableTenancy[] };

/**
 * Decide what the /tenant/rent or /tenant/documents index page should
 * do based on the caller's tenancies.
 *
 * Sorting rule for the multi case: most recent `start_date` first, so
 * the currently-occupied tenancy bubbles to the top of the picker.
 */
export function chooseTenancyTarget(
  tenancies: readonly ChoosableTenancy[]
): TenancyChooserResult {
  if (tenancies.length === 0) return { kind: "empty" };
  if (tenancies.length === 1)
    return { kind: "one", targetId: tenancies[0]!.id };

  const sorted = [...tenancies].sort((a, b) =>
    b.start_date.localeCompare(a.start_date)
  );
  return { kind: "multi", tenancies: sorted };
}
