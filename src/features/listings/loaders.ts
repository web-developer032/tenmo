import 'server-only';
import { DbError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

/**
 * Loaders for the landlord listings manager.
 *
 * These run inside React Server Components, so they use the user-scoped
 * server client. RLS narrows visibility to rooms the caller's org can see.
 */

export interface LandlordRoomListingRow {
  id: string;
  property_id: string;
  property_name: string;
  property_city: string | null;
  name: string;
  status: string;
  default_rent_pence: number | null;
  default_rent_frequency: 'monthly' | 'weekly';
  has_ensuite: boolean;
  listing_status: 'draft' | 'published' | 'paused' | 'closed';
  listing_published_at: string | null;
  listing_description: string | null;
  listing_available_from: string | null;
  listing_bills_included: boolean;
  pending_application_count: number;
}

/**
 * Returns every room in the org with its listing fields and a count of
 * pending applications (so the listings manager can flag rooms that need
 * landlord attention without an N+1).
 */
export async function loadLandlordListings(orgId: string): Promise<LandlordRoomListingRow[]> {
  const sb = await createClient();
  const { data: rooms, error } = await sb
    .from('rooms')
    .select(
      `id, property_id, name, status, default_rent_pence, default_rent_frequency, has_ensuite,
       listing_status, listing_published_at, listing_description, listing_available_from, listing_bills_included,
       properties:property_id ( name, address )`,
    )
    .eq('org_id', orgId)
    .is('archived_at', null)
    .order('listing_status', { ascending: true })
    .order('property_id', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new DbError(error);
  const list = (rooms ?? []) as Array<{
    id: string;
    property_id: string;
    name: string;
    status: string;
    default_rent_pence: number | null;
    default_rent_frequency: 'monthly' | 'weekly';
    has_ensuite: boolean;
    listing_status: LandlordRoomListingRow['listing_status'];
    listing_published_at: string | null;
    listing_description: string | null;
    listing_available_from: string | null;
    listing_bills_included: boolean;
    properties:
      | { name: string; address: { city?: string | null } | null }
      | { name: string; address: { city?: string | null } | null }[]
      | null;
  }>;

  const roomIds = list.map((r) => r.id);
  let pendingByRoom = new Map<string, number>();
  if (roomIds.length > 0) {
    const { data: pending } = await sb
      .from('room_applications')
      .select('room_id')
      .in('room_id', roomIds)
      .eq('status', 'pending');
    if (pending) {
      pendingByRoom = pending.reduce((acc, row) => {
        acc.set(row.room_id, (acc.get(row.room_id) ?? 0) + 1);
        return acc;
      }, new Map<string, number>());
    }
  }

  return list.map((r) => {
    const property = Array.isArray(r.properties) ? r.properties[0] : r.properties;
    return {
      id: r.id,
      property_id: r.property_id,
      property_name: property?.name ?? 'Property',
      property_city: property?.address?.city ?? null,
      name: r.name,
      status: r.status,
      default_rent_pence: r.default_rent_pence,
      default_rent_frequency: r.default_rent_frequency,
      has_ensuite: r.has_ensuite,
      listing_status: r.listing_status,
      listing_published_at: r.listing_published_at,
      listing_description: r.listing_description,
      listing_available_from: r.listing_available_from,
      listing_bills_included: r.listing_bills_included,
      pending_application_count: pendingByRoom.get(r.id) ?? 0,
    };
  });
}
