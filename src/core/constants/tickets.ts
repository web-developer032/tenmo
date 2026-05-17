/**
 * Maintenance ticket domain — categories, severities, statuses, SLAs.
 *
 * Source of truth for both the database enums (`ticket_category`,
 * `ticket_severity`, `ticket_status`) and the AI-triage stub. Keep in sync
 * with `backend/supabase/migrations/20260101001000_tickets.sql`.
 */

export type TicketCategory =
  | 'heating_hot_water'
  | 'plumbing'
  | 'electrical'
  | 'appliance'
  | 'structural'
  | 'damp_mould'
  | 'pest'
  | 'security'
  | 'communal_area'
  | 'garden_outdoor'
  | 'cleaning'
  | 'noise_neighbour'
  | 'other';

export type TicketSeverity = 'low' | 'medium' | 'high' | 'critical';

export type TicketStatus =
  | 'open'
  | 'triaged'
  | 'in_progress'
  | 'awaiting_tenant'
  | 'awaiting_contractor'
  | 'resolved'
  | 'closed'
  | 'cancelled';

export type TicketMessageKind =
  | 'comment'
  | 'system_status'
  | 'system_assigned'
  | 'system_severity'
  | 'system_note';

/** Per-category metadata used by triage + UI labels + keyword detection. */
export type TicketCategoryRule = {
  type: TicketCategory;
  label: string;
  description: string;
  /** Lowercase keywords/phrases used by the simple AI triage stub. */
  keywords: string[];
  /** Default severity when this category is detected (overridable by user). */
  defaultSeverity: TicketSeverity;
  /** Whether by default this category implies a habitability risk. */
  habitabilityRisk: boolean;
};

export const TICKET_CATEGORY_RULES: Record<TicketCategory, TicketCategoryRule> = {
  heating_hot_water: {
    type: 'heating_hot_water',
    label: 'Heating / hot water',
    description: 'Boiler, radiators, hot water, thermostat, hot tap.',
    keywords: [
      'boiler',
      'heating',
      'radiator',
      'no hot water',
      'cold water',
      'thermostat',
      'leak from boiler',
      'pilot light',
      'gas smell',
    ],
    defaultSeverity: 'high',
    habitabilityRisk: true,
  },
  plumbing: {
    type: 'plumbing',
    label: 'Plumbing',
    description: 'Leaks, blocked drains, toilets, taps, shower drainage.',
    keywords: [
      'leak',
      'leaking',
      'drip',
      'drain',
      'drainage',
      'block',
      'toilet',
      'flush',
      'tap',
      'shower',
      'sink',
      'pipe',
      'water damage',
    ],
    defaultSeverity: 'high',
    habitabilityRisk: false,
  },
  electrical: {
    type: 'electrical',
    label: 'Electrical',
    description: 'Wiring, sockets, lights, fuse box, smoke alarms.',
    keywords: [
      'electric',
      'electrical',
      'socket',
      'plug',
      'wire',
      'wiring',
      'bulb',
      'light',
      'lamp',
      'fuse',
      'breaker',
      'smoke alarm',
      'co alarm',
      'flicker',
      'shock',
      'spark',
    ],
    defaultSeverity: 'high',
    habitabilityRisk: false,
  },
  appliance: {
    type: 'appliance',
    label: 'Appliance',
    description: 'Fridge, oven, hob, washing machine, dishwasher, dryer.',
    keywords: [
      'fridge',
      'freezer',
      'oven',
      'hob',
      'cooker',
      'microwave',
      'kettle',
      'washing machine',
      'washer',
      'dishwasher',
      'tumble dryer',
      'dryer',
    ],
    defaultSeverity: 'medium',
    habitabilityRisk: false,
  },
  structural: {
    type: 'structural',
    label: 'Structural',
    description: 'Cracks, walls, ceilings, floors, doors, windows, roof.',
    keywords: [
      'crack',
      'wall',
      'ceiling',
      'floor',
      'door',
      'window',
      'roof',
      'gutter',
      'render',
      'plaster',
      'subsidence',
    ],
    defaultSeverity: 'medium',
    habitabilityRisk: false,
  },
  damp_mould: {
    type: 'damp_mould',
    label: 'Damp / mould',
    description: 'Damp patches, mould, condensation, dripping windows.',
    keywords: ['damp', 'mould', 'mold', 'condensation', 'mildew', 'fungus'],
    defaultSeverity: 'high',
    habitabilityRisk: true,
  },
  pest: {
    type: 'pest',
    label: 'Pest control',
    description: 'Mice, rats, cockroaches, bed bugs, ants, wasps.',
    keywords: [
      'mice',
      'mouse',
      'rats',
      'rat',
      'cockroach',
      'bed bug',
      'bedbug',
      'ant',
      'wasp',
      'infestation',
      'pest',
    ],
    defaultSeverity: 'high',
    habitabilityRisk: true,
  },
  security: {
    type: 'security',
    label: 'Security',
    description: 'Locks, keys, alarms, broken windows, intercom.',
    keywords: [
      'lock',
      'key',
      'broken in',
      'break-in',
      'broken window',
      'alarm',
      'intercom',
      'cctv',
      'unsafe',
    ],
    defaultSeverity: 'critical',
    habitabilityRisk: true,
  },
  communal_area: {
    type: 'communal_area',
    label: 'Communal area',
    description: 'Hallway, stairs, shared kitchen, shared bathroom.',
    keywords: ['communal', 'shared', 'hallway', 'corridor', 'stairs', 'lift', 'lobby'],
    defaultSeverity: 'medium',
    habitabilityRisk: false,
  },
  garden_outdoor: {
    type: 'garden_outdoor',
    label: 'Garden / outdoors',
    description: 'Garden, fence, bins, drives, paths, exterior lighting.',
    keywords: ['garden', 'fence', 'gate', 'bin', 'driveway', 'path', 'shed'],
    defaultSeverity: 'low',
    habitabilityRisk: false,
  },
  cleaning: {
    type: 'cleaning',
    label: 'Cleaning',
    description: 'Cleaning of communal areas, end-of-tenancy, deep cleans.',
    keywords: ['clean', 'cleaning', 'rubbish', 'bin smell', 'dust', 'hoover', 'vacuum'],
    defaultSeverity: 'low',
    habitabilityRisk: false,
  },
  noise_neighbour: {
    type: 'noise_neighbour',
    label: 'Noise / neighbour',
    description: 'Noise complaints, anti-social behaviour, neighbour disputes.',
    keywords: ['noise', 'noisy', 'loud', 'neighbour', 'anti-social', 'asb', 'party'],
    defaultSeverity: 'medium',
    habitabilityRisk: false,
  },
  other: {
    type: 'other',
    label: 'Other',
    description: 'Anything else.',
    keywords: [],
    defaultSeverity: 'medium',
    habitabilityRisk: false,
  },
};

export type TicketSeverityRule = {
  level: TicketSeverity;
  label: string;
  description: string;
  /**
   * Target time to first response, in hours. Used by the dashboard SLA
   * widgets and to colour-code "stale" tickets.
   */
  firstResponseHours: number;
  /** Target time to resolution. */
  resolutionHours: number;
};

export const TICKET_SEVERITY_RULES: Record<TicketSeverity, TicketSeverityRule> = {
  critical: {
    level: 'critical',
    label: 'Critical',
    description: 'Risk to safety, security or habitability — act immediately.',
    firstResponseHours: 2,
    resolutionHours: 24,
  },
  high: {
    level: 'high',
    label: 'High',
    description: 'Major function impaired (no heating, single utility down).',
    firstResponseHours: 8,
    resolutionHours: 72,
  },
  medium: {
    level: 'medium',
    label: 'Medium',
    description: 'Degraded service but property remains habitable.',
    firstResponseHours: 24,
    resolutionHours: 168,
  },
  low: {
    level: 'low',
    label: 'Low',
    description: 'Cosmetic or convenience.',
    firstResponseHours: 72,
    resolutionHours: 720,
  },
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  triaged: 'Triaged',
  in_progress: 'In progress',
  awaiting_tenant: 'Waiting on tenant',
  awaiting_contractor: 'Waiting on contractor',
  resolved: 'Resolved',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

/** Statuses that count as "open work" on the kanban / dashboard widgets. */
export const TICKET_OPEN_STATUSES: TicketStatus[] = [
  'open',
  'triaged',
  'in_progress',
  'awaiting_tenant',
  'awaiting_contractor',
];

export const TICKET_TERMINAL_STATUSES: TicketStatus[] = ['closed', 'cancelled'];

export const TICKET_CATEGORY_VALUES: TicketCategory[] = Object.keys(
  TICKET_CATEGORY_RULES,
) as TicketCategory[];

export const TICKET_SEVERITY_VALUES: TicketSeverity[] = ['low', 'medium', 'high', 'critical'];

export const TICKET_STATUS_VALUES: TicketStatus[] = [
  'open',
  'triaged',
  'in_progress',
  'awaiting_tenant',
  'awaiting_contractor',
  'resolved',
  'closed',
  'cancelled',
];

/** Max attachment file size we accept in the UI (matches storage bucket). */
export const TICKET_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

export const TICKET_ATTACHMENT_MIME_ALLOWLIST = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'video/mp4',
  'video/quicktime',
] as const;

export type TicketAttachmentMime = (typeof TICKET_ATTACHMENT_MIME_ALLOWLIST)[number];
