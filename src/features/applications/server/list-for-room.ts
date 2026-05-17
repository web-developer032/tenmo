import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ApplicationStatus } from '@/core/constants/listings';
import {
  type ApplicantStatusCounts,
  sortApplicantsForLandlordQueue,
  summariseApplicants,
} from '@/core/utils/applicants';
import { DbError, NotFoundError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';

/**
 * Landlord view: paginated applicant queue for a room they manage.
 *
 * Joined with `profiles` so the queue can show the applicant's display name
 * + masked contact. RLS already restricts the query to org members of the
 * room; this code does not duplicate that check.
 */

export interface ApplicantQueueRow {
  id: string;
  applicant_user_id: string;
  status: ApplicationStatus;
  message: string | null;
  applied_at: string;
  decided_at: string | null;
  decline_reason: string | null;
  resulting_tenancy_id: string | null;
  applicant_name: string | null;
  applicant_avatar_url: string | null;
  applicant_contact_email: string | null;
}

export interface ListForRoomResult {
  rows: ApplicantQueueRow[];
  counts: ApplicantStatusCounts;
  total: number;
}

export async function listApplicationsForRoomWithClient(
  sb: SupabaseClient,
  roomId: string,
): Promise<ListForRoomResult> {
  const { data, error, count } = await sb
    .from('room_applications')
    .select(
      `id, applicant_user_id, status, message, applied_at, decided_at, decline_reason, resulting_tenancy_id,
       profiles:applicant_user_id ( full_name, avatar_url, contact_email )`,
      { count: 'exact' },
    )
    .eq('room_id', roomId)
    .order('applied_at', { ascending: true });
  if (error) throw new DbError(error);

  type ProfileEmbed = {
    full_name: string | null;
    avatar_url: string | null;
    contact_email: string | null;
  };
  type Row = {
    id: string;
    applicant_user_id: string;
    status: ApplicationStatus;
    message: string | null;
    applied_at: string;
    decided_at: string | null;
    decline_reason: string | null;
    resulting_tenancy_id: string | null;
    // PostgREST returns embeds as arrays even for to-one — accept both shapes.
    profiles: ProfileEmbed | ProfileEmbed[] | null;
  };

  const raw = ((data as unknown as Row[] | null) ?? []).map<ApplicantQueueRow>((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      applicant_user_id: r.applicant_user_id,
      status: r.status,
      message: r.message,
      applied_at: r.applied_at,
      decided_at: r.decided_at,
      decline_reason: r.decline_reason,
      resulting_tenancy_id: r.resulting_tenancy_id,
      applicant_name: profile?.full_name ?? null,
      applicant_avatar_url: profile?.avatar_url ?? null,
      applicant_contact_email: profile?.contact_email ?? null,
    };
  });

  return {
    rows: sortApplicantsForLandlordQueue(raw),
    counts: summariseApplicants(raw),
    total: count ?? 0,
  };
}

export async function listApplicationsForRoom(
  ctx: HandlerContext,
  roomId: string,
): Promise<ListForRoomResult> {
  requireUser(ctx);
  // RLS narrows visibility, but we want a friendly 404 for a room that
  // doesn't exist (vs. an empty list, which would mask typos).
  const { data: room, error: roomErr } = await ctx.supabase
    .from('rooms')
    .select('id')
    .eq('id', roomId)
    .maybeSingle();
  if (roomErr) throw new DbError(roomErr);
  if (!room) throw new NotFoundError('Room not found');

  return listApplicationsForRoomWithClient(ctx.supabase, roomId);
}
