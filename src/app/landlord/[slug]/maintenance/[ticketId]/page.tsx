import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { TicketAssignmentPanel } from '@/features/tickets/components/ticket-assignment-panel';
import { TicketDetailView } from '@/features/tickets/components/ticket-detail-view';
import { loadOrgAssignmentMembers, loadTicketPage } from '@/features/tickets/loaders';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string; ticketId: string };

export const dynamic = 'force-dynamic';

/**
 * Landlord-side ticket detail.
 *
 * The org is verified via the layout + `resolveOrgBySlug`, the ticket
 * itself is RLS-scoped (members of the org can read every ticket in their
 * org), and we additionally guard that the loaded ticket belongs to this
 * org so a wrong slug can't expose data.
 */
export default async function LandlordTicketDetailPage({ params }: { params: Promise<Params> }) {
  const { slug, ticketId } = await params;
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/landlord/${slug}/maintenance/${ticketId}`);

  const data = await loadTicketPage(ticketId);
  if (!data || data.ticket.org_id !== org.id) notFound();

  const members = await loadOrgAssignmentMembers(org.id);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 md:px-8 md:py-8">
      <Link
        href={`/landlord/${slug}/maintenance`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to maintenance
      </Link>

      <TicketDetailView
        data={data}
        actorRole="landlord"
        currentUserId={user.id}
        extraSidebar={
          <TicketAssignmentPanel
            ticketId={data.ticket.id}
            members={members}
            currentUserId={data.ticket.assigned_to_user_id}
            currentContractor={data.ticket.assigned_contractor}
          />
        }
      />
    </div>
  );
}
