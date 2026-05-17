import { z } from 'zod';
import {
  LISTING_SEARCH_MAX_PAGE_SIZE,
  LISTING_SEARCH_PAGE_SIZE,
  LISTING_STATUS_VALUES,
} from '../constants/listings';
import { dateIso, optionalString, pence, uuid } from './common';
import { RoomFurnishing } from './room';

/**
 * Listing — Phase Q.
 *
 * A "listing" is not a separate entity in the database; it is the set of
 * `listing_*` columns on `public.rooms`. The schemas here describe:
 *
 *   - the public, anon-safe shape returned by `search_published_listings`
 *     and `get_published_listing` RPCs (no PII, no full street address for
 *     anonymous viewers)
 *   - the input shape the landlord submits when publishing or editing a
 *     listing
 *   - the filter object accepted by the public search page
 */

export const ListingStatus = z.enum(LISTING_STATUS_VALUES as unknown as [string, ...string[]]);
export type ListingStatus = z.infer<typeof ListingStatus>;

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
 * Public-safe listing card. Mirrors the row shape returned by
 * `public.search_published_listings`. `full_address` is null for
 * anonymous viewers and a structured Address jsonb for signed-in viewers.
 */
export const PublicListing = z.object({
  room_id: uuid,
  property_id: uuid,
  property_name: z.string(),
  property_type: PropertyType,
  city: z.string().nullable(),
  postcode_outward: z.string().nullable(),
  full_address: z
    .object({
      line1: z.string(),
      line2: z.string().nullable().optional(),
      city: z.string(),
      postcode: z.string(),
      country: z.string().optional().default('GB'),
    })
    .nullable(),
  room_name: z.string(),
  room_description: z.string().nullable(),
  size_sqm: z.number().nullable(),
  has_ensuite: z.boolean(),
  has_double_bed: z.boolean(),
  furnishing: RoomFurnishing,
  default_rent_pence: z.number().int().nullable(),
  default_rent_currency: z.string().default('GBP'),
  default_rent_frequency: z.enum(['monthly', 'weekly']),
  bills_included: z.boolean(),
  listing_description: z.string().nullable(),
  listing_available_from: z.string().nullable(),
  listing_min_term_months: z.number().int().nullable(),
  listing_bills_included: z.boolean(),
  listing_published_at: z.string().nullable(),
});
export type PublicListing = z.infer<typeof PublicListing>;

/** Filter shape for the public listings page. All fields are optional. */
export const ListingFilters = z.object({
  city: optionalString(z.string().trim().min(1).max(80)),
  postcode_prefix: optionalString(
    z
      .string()
      .trim()
      .min(1)
      .max(4)
      .regex(/^[A-Za-z]{1,2}\d[A-Za-z\d]?$/, 'Use the outward part of a UK postcode (e.g. SW1A).'),
  ),
  min_rent_pence: pence.optional().nullable(),
  max_rent_pence: pence.optional().nullable(),
  property_type: PropertyType.optional().nullable(),
  has_ensuite: z.boolean().optional().nullable(),
  available_from: optionalString(dateIso),
  page: z.number().int().min(1).default(1),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(LISTING_SEARCH_MAX_PAGE_SIZE)
    .default(LISTING_SEARCH_PAGE_SIZE),
});
export type ListingFilters = z.infer<typeof ListingFilters>;

/**
 * Form schema used by the landlord to publish or edit a listing's metadata.
 * The room's rent + furnishing live on the underlying room and aren't edited
 * here — landlords change those via the existing room edit form.
 */
export const ListingPublishInput = z.object({
  listing_description: optionalString(z.string().trim().min(20).max(4000)),
  listing_available_from: optionalString(dateIso),
  listing_min_term_months: z
    .union([z.number().int().min(1).max(60), z.null()])
    .optional()
    .nullable(),
  listing_bills_included: z.boolean().default(false),
});
export type ListingPublishInput = z.infer<typeof ListingPublishInput>;
