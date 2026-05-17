import { z } from 'zod';
import { Address, uuid } from './common';

/** Property type — drives compliance defaults. */
export const PropertyType = z.enum([
  'whole_property',
  'hmo_small',
  'hmo_large',
  'flat',
  'studio',
  'bedsit',
]);
export type PropertyType = z.infer<typeof PropertyType>;

/**
 * Property — a physical address. May contain one or more rooms.
 * `is_hmo` is derived from occupancy but stored for fast queries.
 */
export const Property = z.object({
  id: uuid,
  org_id: uuid,
  name: z.string().min(1).max(120),
  type: PropertyType,
  address: Address,
  is_hmo: z.boolean().default(false),
  hmo_licence_required: z.boolean().default(false),
  total_rooms: z.number().int().min(0).default(0),
  notes: z.string().nullable(),
  archived_at: z.string().nullable(),
  created_by: uuid,
  created_at: z.string(),
  updated_at: z.string(),
});
export type Property = z.infer<typeof Property>;

/** Form schema for property creation — `org_id` is in the URL, not the body. */
export const PropertyCreate = z.object({
  name: z.string().trim().min(1, 'Property needs a name').max(120),
  type: PropertyType,
  address: Address,
  notes: z.string().trim().max(2000).optional().nullable(),
});
export type PropertyCreate = z.infer<typeof PropertyCreate>;

export const PropertyUpdate = PropertyCreate.partial();
export type PropertyUpdate = z.infer<typeof PropertyUpdate>;
