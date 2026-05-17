/**
 * Bills domain — bill types, allocation methods, UI labels.
 *
 * Source of truth for the Postgres enums `bill_type` and
 * `bill_allocation_method` (see migration
 * `20260101002000_bills.sql`). Keep these in sync.
 */

export type BillType =
  | 'electricity'
  | 'gas'
  | 'water'
  | 'council_tax'
  | 'internet'
  | 'tv_licence'
  | 'other';

export const BILL_TYPE_VALUES: BillType[] = [
  'electricity',
  'gas',
  'water',
  'council_tax',
  'internet',
  'tv_licence',
  'other',
];

export const BILL_TYPE_LABEL: Record<BillType, string> = {
  electricity: 'Electricity',
  gas: 'Gas',
  water: 'Water',
  council_tax: 'Council Tax',
  internet: 'Internet',
  tv_licence: 'TV Licence',
  other: 'Other',
};

export type BillAllocationMethod =
  | 'equal_per_room'
  | 'by_share'
  | 'included_in_rent'
  | 'landlord_pays';

export const BILL_ALLOCATION_METHOD_VALUES: BillAllocationMethod[] = [
  'equal_per_room',
  'by_share',
  'included_in_rent',
  'landlord_pays',
];

export const BILL_ALLOCATION_METHOD_LABEL: Record<BillAllocationMethod, string> = {
  equal_per_room: 'Equal per room',
  by_share: 'By share',
  included_in_rent: 'Included in rent',
  landlord_pays: 'Landlord pays',
};

export const BILL_ALLOCATION_METHOD_DESCRIPTION: Record<BillAllocationMethod, string> = {
  equal_per_room: 'Total ÷ number of currently-occupied rooms. Vacant rooms are excluded.',
  by_share:
    'Custom share per room. Shares must sum to exactly 100%. Use for rooms with very different size or usage.',
  included_in_rent:
    'No allocation. Tenants are told the bill is already covered by their rent. We still record it for your books.',
  landlord_pays:
    'No allocation. Hidden from tenants. Useful for occasional bills you absorb for marketing or convenience.',
};

/** True when the method requires per-room allocation rows. */
export const BILL_METHOD_NEEDS_ALLOCATIONS: Record<BillAllocationMethod, boolean> = {
  equal_per_room: true,
  by_share: true,
  included_in_rent: false,
  landlord_pays: false,
};

/** True when tenants can see this bill at all (landlord_pays is
 * landlord-only). */
export const BILL_METHOD_VISIBLE_TO_TENANT: Record<BillAllocationMethod, boolean> = {
  equal_per_room: true,
  by_share: true,
  included_in_rent: true,
  landlord_pays: false,
};

/** Basis points → percent for the share UI (10000 bps = 100.00%). */
export const SHARE_BASIS_POINTS_TOTAL = 10000;
