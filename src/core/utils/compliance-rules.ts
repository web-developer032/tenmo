import { addMonths } from 'date-fns';
import {
  COMPLIANCE_RULES,
  type ComplianceStatus,
  type ComplianceType,
} from '../constants/compliance';
import type { ComplianceItem } from '../schemas/compliance';
import type { PropertyType } from '../schemas/property';
import { fromIsoDate, toIsoDate } from './dates';

/**
 * Compliance — domain rules.
 *
 * Pure functions only. Source of truth for "what does a UK HMO landlord
 * legally need on file?" and "when do we remind them?". Lives in `core/`
 * so the same logic is shared by web, mobile, and the cron job.
 */

const HMO_PROPERTY_TYPES: ReadonlySet<PropertyType> = new Set(['hmo_small', 'hmo_large']);

/**
 * Returns the certificates a property is *legally required* to hold.
 *
 * - Every let property: gas_safety, eicr, epc.
 * - HMOs (small/large) additionally need: hmo_licence, fire_risk_assessment.
 *
 * Mirrors `public.required_compliance_types` in the database.
 */
export function requiredItemsForProperty(
  propertyType: PropertyType,
  isHmo: boolean,
): ComplianceType[] {
  const baseline: ComplianceType[] = ['gas_safety', 'eicr', 'epc'];
  const hmo = isHmo || HMO_PROPERTY_TYPES.has(propertyType);
  return hmo ? [...baseline, 'hmo_licence', 'fire_risk_assessment'] : baseline;
}

/**
 * Derive the `expires_at` date from `issued_at` based on the type's
 * `validityMonths`. Returns `null` for types without a fixed validity (e.g.
 * smoke alarm tests, deposit protection — those are point-in-time events).
 */
export function derivedExpiresAt(
  type: ComplianceType,
  issuedAtIso: string | null | undefined,
): string | null {
  if (!issuedAtIso) return null;
  const rule = COMPLIANCE_RULES[type];
  if (!rule.validityMonths) return null;
  return toIsoDate(addMonths(fromIsoDate(issuedAtIso), rule.validityMonths));
}

/**
 * Returns the reminder buckets that should be checked on a given run, in
 * descending order. Used by the cron handler when calling
 * `due_compliance_reminders`. Combines all rule windows + a "0" bucket for
 * the day of expiry.
 */
export function reminderBuckets(): number[] {
  const set = new Set<number>([0]);
  for (const rule of Object.values(COMPLIANCE_RULES)) {
    for (const day of rule.reminderDaysBefore) set.add(day);
  }
  return Array.from(set).sort((a, b) => b - a);
}

export type ComplianceItemLike = Pick<ComplianceItem, 'status' | 'type' | 'expires_at'>;

/**
 * Compute a 0..100 health score from a set of compliance items. Used by the
 * dashboard to show overall org/property health at a glance.
 *
 * Weighting:
 *   - overdue:  0
 *   - unknown:  0.25  (cert missing — risky but recoverable)
 *   - due_soon: 0.6   (action needed but not yet failing)
 *   - ok:       1
 *
 * `unknown` items count toward the denominator only if the type is in the
 * required set, otherwise they're ignored.
 */
export function complianceScore(
  items: readonly ComplianceItemLike[],
  required?: readonly ComplianceType[],
): number {
  const requiredSet = required ? new Set(required) : null;
  const considered = items.filter((it) => {
    if (it.status === 'unknown' && requiredSet && !requiredSet.has(it.type)) return false;
    return true;
  });
  if (considered.length === 0) return 100;

  const weight: Record<ComplianceStatus, number> = {
    ok: 1,
    due_soon: 0.6,
    unknown: 0.25,
    overdue: 0,
  };
  const total = considered.reduce((sum, it) => sum + weight[it.status], 0);
  return Math.round((total / considered.length) * 100);
}

export type GroupedCompliance<T extends ComplianceItemLike> = Record<ComplianceStatus, T[]>;

/** Group items by traffic-light status. Stable by input order within each bucket. */
export function groupByStatus<T extends ComplianceItemLike>(
  items: readonly T[],
): GroupedCompliance<T> {
  const groups: GroupedCompliance<T> = { overdue: [], due_soon: [], unknown: [], ok: [] };
  for (const it of items) groups[it.status].push(it);
  return groups;
}

/**
 * Returns the items missing from the required set (i.e. types that should
 * exist but don't). Used to render "Add this cert" placeholders.
 */
export function missingRequiredTypes(
  items: readonly ComplianceItemLike[],
  required: readonly ComplianceType[],
): ComplianceType[] {
  const present = new Set(items.map((it) => it.type));
  return required.filter((t) => !present.has(t));
}

/**
 * Whether *all* compliance items required for tenancy activation are `ok`.
 *
 * Tenancy activation rules in the UK:
 *   - Gas safety must be in date
 *   - EICR must be in date
 *   - EPC must be at least band E (we approximate via expiry)
 *   - HMO licence (if applicable) must be in date
 *   - Smoke / CO alarms tested at start (point-in-time, recorded as `ok`)
 *   - Deposit protection completed
 *
 * The function uses the type's `blocksTenancyActivation` flag from
 * `COMPLIANCE_RULES`. If a blocking type is missing, returns `false`.
 */
export function tenancyActivationBlockers(
  items: readonly ComplianceItemLike[],
  required: readonly ComplianceType[] = ['gas_safety', 'eicr', 'epc'],
): ComplianceType[] {
  const blockers: ComplianceType[] = [];
  const byType = new Map<ComplianceType, ComplianceItemLike>();
  for (const it of items) byType.set(it.type, it);

  for (const t of required) {
    if (!COMPLIANCE_RULES[t].blocksTenancyActivation) continue;
    const item = byType.get(t);
    if (!item || item.status !== 'ok') blockers.push(t);
  }
  return blockers;
}
