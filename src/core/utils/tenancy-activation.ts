/**
 * Tenancy activation rules — single source of truth for what blocks
 * a tenancy from moving `draft|awaiting_signature|awaiting_deposit`
 * → `active`. The same logic runs:
 *
 *   - Server-side in `features/tenancies/server/check-and-activate.ts`
 *     (after every AST / RTR / deposit event, plus a daily cron).
 *   - Client-side in `TenancyActivationChecklist` so the landlord
 *     sees exactly the same blockers we'd evaluate.
 *
 * Per docs/07-flows/05-tenancy-lifecycle.md, a tenancy activates
 * when ALL of:
 *
 *   1. AST signed (`ast_signed_at IS NOT NULL`).
 *   2. Deposit registered (`deposit_protected_at IS NOT NULL` OR
 *      `deposit_pence = 0`).
 *   3. RTR check `current` (a `compliance_items` row of type
 *      `right_to_rent` with status `current`).
 *   4. Tenant accepted (`tenant_user_id IS NOT NULL`).
 *   5. `start_date <= today`.
 *
 * Pure module — no Supabase, no React. Both sides feed it the same
 * shape; we don't over-narrow Pick<> so callers can pass partial
 * tenancy rows.
 */

export type ActivationBlockerCode =
  | 'tenant_not_accepted'
  | 'ast_not_signed'
  | 'deposit_not_protected'
  | 'rtr_not_current'
  | 'start_date_in_future';

export interface ActivationBlocker {
  code: ActivationBlockerCode;
  message: string;
}

export interface ActivationInputs {
  /** Has the tenant accepted the invite? */
  tenant_user_id: string | null | undefined;
  /** Set when the AST was signed. */
  ast_signed_at: string | null | undefined;
  /** Deposit pence required by the tenancy (0 means no deposit). */
  deposit_pence: number;
  /** Set when the deposit has been protected with a scheme. */
  deposit_protected_at: string | null | undefined;
  /** True if a `right_to_rent` compliance item is `current`. */
  rtr_current: boolean;
  /** ISO yyyy-mm-dd of the tenancy start date. */
  start_date: string;
  /** Optional reference clock for testing — defaults to today. */
  today?: string;
}

export interface ActivationDecision {
  canActivate: boolean;
  blockers: ActivationBlocker[];
}

const BLOCKER_COPY: Record<ActivationBlockerCode, string> = {
  tenant_not_accepted: 'Tenant has not accepted the invite yet.',
  ast_not_signed: 'AST has not been signed by both parties.',
  deposit_not_protected: 'Deposit has not been protected with a scheme yet.',
  rtr_not_current: 'Right to Rent check is not current.',
  start_date_in_future: 'Tenancy start date has not been reached yet.',
};

/** Derive the structured set of blockers preventing activation. The
 * empty array means the tenancy is ready to go active. */
export function deriveActivationBlockers(input: ActivationInputs): ActivationDecision {
  const blockers: ActivationBlocker[] = [];

  if (!input.tenant_user_id) {
    blockers.push(blocker('tenant_not_accepted'));
  }
  if (!input.ast_signed_at) {
    blockers.push(blocker('ast_not_signed'));
  }
  if (input.deposit_pence > 0 && !input.deposit_protected_at) {
    blockers.push(blocker('deposit_not_protected'));
  }
  if (!input.rtr_current) {
    blockers.push(blocker('rtr_not_current'));
  }
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  if (input.start_date > today) {
    blockers.push(blocker('start_date_in_future'));
  }

  return {
    canActivate: blockers.length === 0,
    blockers,
  };
}

function blocker(code: ActivationBlockerCode): ActivationBlocker {
  return { code, message: BLOCKER_COPY[code] };
}
