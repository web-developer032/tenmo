/**
 * Compliance domain — UK rules encoded as data.
 *
 * Source: docs/08-uk-compliance/safety-certificates.md and friends.
 * Treat as authoritative; UK property law is precise.
 */

export type ComplianceType =
  | 'hmo_licence'
  | 'gas_safety'
  | 'eicr'
  | 'epc'
  | 'pat_test'
  | 'fire_risk_assessment'
  | 'legionella'
  | 'right_to_rent'
  | 'smoke_alarm_test'
  | 'co_alarm_test'
  | 'deposit_protection';

export type ComplianceRule = {
  type: ComplianceType;
  label: string;
  /** Months until expiry from issue date. `null` = no fixed expiry. */
  validityMonths: number | null;
  /** Reminder days-before-expiry to fire. */
  reminderDaysBefore: number[];
  /** Required for HMOs only. */
  hmoOnly: boolean;
  /** Required for tenancy activation. */
  blocksTenancyActivation: boolean;
  /** Helpful description for the UI. */
  description: string;
};

export const COMPLIANCE_RULES: Record<ComplianceType, ComplianceRule> = {
  hmo_licence: {
    type: 'hmo_licence',
    label: 'HMO Licence',
    validityMonths: 60,
    reminderDaysBefore: [60, 30, 7],
    hmoOnly: true,
    blocksTenancyActivation: true,
    description:
      'Required for HMOs of 5+ unrelated occupants from 2+ households. Renewal varies by council.',
  },
  gas_safety: {
    type: 'gas_safety',
    label: 'Gas Safety (CP12)',
    validityMonths: 12,
    reminderDaysBefore: [60, 30, 7],
    hmoOnly: false,
    blocksTenancyActivation: true,
    description: 'Annual inspection of all gas appliances and pipework by a Gas Safe engineer.',
  },
  eicr: {
    type: 'eicr',
    label: 'EICR (Electrical)',
    validityMonths: 60,
    reminderDaysBefore: [90, 30, 7],
    hmoOnly: false,
    blocksTenancyActivation: true,
    description: 'Electrical Installation Condition Report. Mandatory every 5 years.',
  },
  epc: {
    type: 'epc',
    label: 'EPC',
    validityMonths: 120,
    reminderDaysBefore: [180, 60, 7],
    hmoOnly: false,
    blocksTenancyActivation: true,
    description:
      'Energy Performance Certificate. Min E required; target C+ from 2028 for new tenancies.',
  },
  pat_test: {
    type: 'pat_test',
    label: 'PAT (Portable Appliance Test)',
    validityMonths: 12,
    reminderDaysBefore: [60, 30, 7],
    hmoOnly: false,
    blocksTenancyActivation: false,
    description: 'Recommended annual test of supplied portable electrical appliances.',
  },
  fire_risk_assessment: {
    type: 'fire_risk_assessment',
    label: 'Fire Risk Assessment',
    validityMonths: 12,
    reminderDaysBefore: [60, 30, 7],
    hmoOnly: true,
    blocksTenancyActivation: true,
    description: 'Annual FRA required for HMOs and shared parts of properties.',
  },
  legionella: {
    type: 'legionella',
    label: 'Legionella Risk Assessment',
    validityMonths: 24,
    reminderDaysBefore: [60, 30, 7],
    hmoOnly: false,
    blocksTenancyActivation: false,
    description: 'Required at start of tenancy and on system changes.',
  },
  right_to_rent: {
    type: 'right_to_rent',
    label: 'Right to Rent',
    validityMonths: null,
    reminderDaysBefore: [60, 30, 7],
    hmoOnly: false,
    blocksTenancyActivation: true,
    description:
      'Per-occupant check before tenancy starts. Time-limited rights need follow-up checks.',
  },
  smoke_alarm_test: {
    type: 'smoke_alarm_test',
    label: 'Smoke Alarm Test',
    validityMonths: null,
    reminderDaysBefore: [],
    hmoOnly: false,
    blocksTenancyActivation: true,
    description: 'Working smoke alarm on every storey. Tested at start of each tenancy.',
  },
  co_alarm_test: {
    type: 'co_alarm_test',
    label: 'CO Alarm Test',
    validityMonths: null,
    reminderDaysBefore: [],
    hmoOnly: false,
    blocksTenancyActivation: true,
    description: 'CO alarm in every room with a fixed combustion appliance.',
  },
  deposit_protection: {
    type: 'deposit_protection',
    label: 'Deposit Protection',
    validityMonths: null,
    reminderDaysBefore: [],
    hmoOnly: false,
    blocksTenancyActivation: true,
    description:
      'Deposit must be protected with DPS / MyDeposits / TDS within 30 days; PI given to tenant.',
  },
};

export type ComplianceStatus = 'ok' | 'due_soon' | 'overdue' | 'unknown';

export const COMPLIANCE_TYPE_VALUES: ComplianceType[] = Object.keys(
  COMPLIANCE_RULES,
) as ComplianceType[];
