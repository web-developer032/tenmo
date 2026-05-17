import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { type ApplicationStatus, TENANT_APPLICATIONS_PAGE_SIZE } from '@/core/constants/listings';
import { DbError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';

/**
 * Tenant view of their own applications.
 *
 * Joined with room + property + org so the "my applications" page can show
 * meaningful cards without N+1 fetches. RLS narrows rows to
 * `applicant_user_id = auth.uid()` so no extra filter is needed here.
 */

export interface MyApplicationRow {
  id: string;
  room_id: string;
  status: ApplicationStatus;
  message: string | null;
  applied_at: string;
  decided_at: string | null;
  decline_reason: string | null;
  resulting_tenancy_id: string | null;
  room_name: string;
  property_name: string;
  property_city: string | null;
  org_name: string;
  default_rent_pence: number | null;
  default_rent_frequency: 'monthly' | 'weekly';
  listing_status: 'draft' | 'published' | 'paused' | 'closed';
}

export interface ListMyApplicationsResult {
  rows: MyApplicationRow[];
  total: number;
  page: number;
  per_page: number;
}

export async function listMyApplicationsWithClient(
  sb: SupabaseClient,
  userId: string,
  page = 1,
  perPage = TENANT_APPLICATIONS_PAGE_SIZE,
): Promise<ListMyApplicationsResult> {
  const safePage = Math.max(1, Math.floor(page));
  const safePerPage = Math.max(1, Math.min(60, Math.floor(perPage)));
  const start = (safePage - 1) * safePerPage;
  const end = start + safePerPage - 1;

  const { data, error, count } = await sb
    .from('room_applications')
    .select(
      `id, room_id, status, message, applied_at, decided_at, decline_reason, resulting_tenancy_id,
       rooms:room_id (
         name,
         default_rent_pence,
         default_rent_frequency,
         listing_status,
         properties:property_id ( name, address ),
         orgs:org_id ( name )
       )`,
      { count: 'exact' },
    )
    .eq('applicant_user_id', userId)
    .order('applied_at', { ascending: false })
    .range(start, end);
  if (error) throw new DbError(error);

  type PropertyEmbed = { name: string; address: { city?: string | null } | null };
  type OrgEmbed = { name: string };
  type RoomEmbed = {
    name: string;
    default_rent_pence: number | null;
    default_rent_frequency: 'monthly' | 'weekly';
    listing_status: 'draft' | 'published' | 'paused' | 'closed';
    properties: PropertyEmbed | PropertyEmbed[] | null;
    orgs: OrgEmbed | OrgEmbed[] | null;
  };
  type Row = {
    id: string;
    room_id: string;
    status: ApplicationStatus;
    message: string | null;
    applied_at: string;
    decided_at: string | null;
    decline_reason: string | null;
    resulting_tenancy_id: string | null;
    rooms: RoomEmbed | RoomEmbed[] | null;
  };

  const rows: MyApplicationRow[] = ((data as unknown as Row[] | null) ?? []).map((r) => {
    const room = Array.isArray(r.rooms) ? r.rooms[0] : r.rooms;
    const property = Array.isArray(room?.properties) ? room?.properties[0] : room?.properties;
    const org = Array.isArray(room?.orgs) ? room?.orgs[0] : room?.orgs;
    return {
      id: r.id,
      room_id: r.room_id,
      status: r.status,
      message: r.message,
      applied_at: r.applied_at,
      decided_at: r.decided_at,
      decline_reason: r.decline_reason,
      resulting_tenancy_id: r.resulting_tenancy_id,
      room_name: room?.name ?? 'Room',
      property_name: property?.name ?? 'Property',
      property_city: property?.address?.city ?? null,
      org_name: org?.name ?? 'Landlord',
      default_rent_pence: room?.default_rent_pence ?? null,
      default_rent_frequency: room?.default_rent_frequency ?? 'monthly',
      listing_status: room?.listing_status ?? 'draft',
    };
  });

  return {
    rows,
    total: count ?? 0,
    page: safePage,
    per_page: safePerPage,
  };
}

export function listMyApplications(
  ctx: HandlerContext,
  page?: number,
  perPage?: number,
): Promise<ListMyApplicationsResult> {
  const user = requireUser(ctx);
  return listMyApplicationsWithClient(ctx.supabase, user.id, page, perPage);
}
