import { z } from 'zod';
import { pence, uuid } from './common';

/**
 * Room — first-class entity for HMOs.
 * Each room is independently lettable, with its own rent and tenancies.
 */
export const RoomFurnishing = z.enum(['furnished', 'part_furnished', 'unfurnished']);
export type RoomFurnishing = z.infer<typeof RoomFurnishing>;

export const RoomStatus = z.enum(['available', 'occupied', 'reserved', 'maintenance', 'archived']);
export type RoomStatus = z.infer<typeof RoomStatus>;

export const Room = z.object({
  id: uuid,
  org_id: uuid,
  property_id: uuid,
  name: z.string().min(1).max(80),
  description: z.string().nullable(),
  size_sqm: z.number().positive().nullable(),
  has_ensuite: z.boolean().default(false),
  has_double_bed: z.boolean().default(false),
  furnishing: RoomFurnishing,
  default_rent_pence: pence.nullable(),
  default_rent_currency: z.string().default('GBP'),
  default_rent_frequency: z.enum(['monthly', 'weekly']).default('monthly'),
  status: RoomStatus.default('available'),
  bills_included: z.boolean().default(false),
  archived_at: z.string().nullable(),
  created_by: uuid,
  created_at: z.string(),
  updated_at: z.string(),
});
export type Room = z.infer<typeof Room>;

/** Form schema for room creation — `property_id`/`org_id` come from the URL. */
export const RoomCreate = z.object({
  name: z.string().trim().min(1, 'Give the room a name').max(80),
  description: z.string().trim().max(2000).optional().nullable(),
  size_sqm: z.number().positive().optional().nullable(),
  has_ensuite: z.boolean().default(false),
  has_double_bed: z.boolean().default(false),
  furnishing: RoomFurnishing,
  default_rent_pence: z.number().int().min(0).optional().nullable(),
  default_rent_frequency: z.enum(['monthly', 'weekly']).default('monthly'),
  bills_included: z.boolean().default(false),
});
export type RoomCreate = z.infer<typeof RoomCreate>;

export const RoomUpdate = RoomCreate.partial().extend({
  status: RoomStatus.optional(),
});
export type RoomUpdate = z.infer<typeof RoomUpdate>;
