import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { TicketDetailView } from '@/features/tickets/components/ticket-detail-view';
import { loadTicketPage } from '@/features/tickets/loaders';
import { createClient } from '@/lib/supabase/server';

type Params = { ticketId: string };

export const dynamic = 'force-dynamic';

/**
 * Tenant-side ticket detail.
 *
 * RLS makes sure tenants only see their own tickets — if `loadTicketPage`
 * returns null we 404 to avoid leaking ticket existence. Status transitions
 * are scoped to the `tenant` role.
 */
export default async function TenantTicketDetailPage({ params }: { params: Promise<Params> }) {
  const { ticketId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/tenant/tickets/${ticketId}`);

  const data = await loadTicketPage(ticketId);
  if (!data) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 md:px-8 md:py-8">
      <Link
        href="/tenant/tickets"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to maintenance
      </Link>

      <TicketDetailView data={data} actorRole="tenant" currentUserId={user.id} />
    </div>
  );
}
