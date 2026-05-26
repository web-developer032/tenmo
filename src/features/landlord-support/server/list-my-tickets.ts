import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DbError } from '@/lib/errors';

/**
 * List the landlord's own platform support tickets — the ones they
 * filed with Tenantly, distinct from the per-property maintenance
 * tickets in `public.tickets`.
 *
 * Read access is scoped at the row level via
 * `platform_support_tickets_select_reporter`, so we don't need to
 * pass the user id here — the RLS check restricts visibility.
 */

export type LandlordSupportTicket = {
  id: string;
  ref_number: number;
  title: string;
  description: string | null;
  category: string;
  priority: 'low' | 'med' | 'high';
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  resolved_at: string | null;
  first_responded_at: string | null;
  csat_rating: number | null;
  csat_submitted_at: string | null;
};

export async function listMySupportTicketsWithClient(
  sb: SupabaseClient,
): Promise<LandlordSupportTicket[]> {
  const { data, error } = await sb
    .from('platform_support_tickets')
    .select(
      'id, ref_number, title, description, category, priority, status, created_at, resolved_at, first_responded_at, csat_rating, csat_submitted_at',
    )
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new DbError(error);
  return (data ?? []) as LandlordSupportTicket[];
}
