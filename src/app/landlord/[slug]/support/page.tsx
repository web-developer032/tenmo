import { CheckCircle2, Clock, LifeBuoy } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/ds/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CsatWidget } from '@/features/landlord-support/components/csat-widget';
import {
  type LandlordSupportTicket,
  listMySupportTicketsWithClient,
} from '@/features/landlord-support/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * /landlord/[slug]/support — the landlord's own platform support
 * tickets (i.e. issues they raised with Tenantly). Resolved tickets
 * show a CSAT widget so we can collect satisfaction data that feeds
 * the admin /admin/support KPI.
 */
export default async function LandlordSupportPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/landlord/${slug}/support`);

  const { data: org } = await supabase
    .from('orgs')
    .select('id, slug, name')
    .eq('slug', slug)
    .maybeSingle();
  if (!org) notFound();

  const tickets = await listMySupportTicketsWithClient(supabase);
  const open = tickets.filter((t) => t.status !== 'resolved');
  const resolved = tickets.filter((t) => t.status === 'resolved');

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: org.name ?? 'Landlord', href: `/landlord/${slug}` },
          { label: 'Support' },
        ]}
        title="Support"
        description="Tickets you've raised with Tenantly. Rate resolved tickets to help us improve."
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <Clock className="h-4 w-4 text-amber" /> Open tickets
            <Badge variant="neutral">{open.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {open.length === 0 ? (
            <p className="text-[13px] text-ink-light">
              No tickets in progress — get in touch via the help button if you need a hand.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-soft">
              {open.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-4 py-3">
                  <TicketHeader ticket={t} />
                  <StatusPill status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <CheckCircle2 className="h-4 w-4 text-forest-600" /> Resolved tickets
            <Badge variant="success">{resolved.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {resolved.length === 0 ? (
            <p className="text-[13px] text-ink-light">
              <LifeBuoy className="mr-1.5 inline-block h-3.5 w-3.5" /> Nothing here yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {resolved.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-col gap-3 rounded-card border border-border-soft bg-bg-page p-3.5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex-1">
                    <TicketHeader ticket={t} />
                  </div>
                  <div className="w-full sm:w-[320px]">
                    <CsatWidget
                      ticketId={t.id}
                      existingRating={t.csat_rating}
                      existingComment={null}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TicketHeader({ ticket }: { ticket: LandlordSupportTicket }) {
  return (
    <div className="min-w-0">
      <div className="text-[14px] font-semibold text-ink">
        #{ticket.ref_number} {ticket.title}
      </div>
      {ticket.description ? (
        <div className="mt-1 line-clamp-2 text-[12.5px] text-ink-mid">{ticket.description}</div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-light">
        <span>Opened {relative(ticket.created_at)}</span>
        {ticket.first_responded_at ? (
          <span>· First reply {relative(ticket.first_responded_at)}</span>
        ) : null}
        {ticket.resolved_at ? <span>· Resolved {relative(ticket.resolved_at)}</span> : null}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: 'open' | 'in_progress' | 'resolved' }) {
  if (status === 'open') return <Badge variant="urgent">Open</Badge>;
  if (status === 'in_progress') return <Badge variant="warning">In progress</Badge>;
  return <Badge variant="success">Resolved</Badge>;
}

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
