import { ArrowLeft, Mail, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isRoomFilledRejection } from '@/core/schemas/application';
import { ApplicantActions } from '@/features/applications/components/applicant-actions';
import { ApplicationStatusBadge } from '@/features/applications/components/application-status-badge';
import { listApplicationsForRoomWithClient } from '@/features/applications/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Params = { slug: string; roomId: string };

export default async function LandlordRoomApplicationsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug, roomId } = await params;
  const supabase = await createClient();
  const { data: room } = await supabase
    .from('rooms')
    .select('id, name, default_rent_pence, default_rent_frequency, properties:property_id(name)')
    .eq('id', roomId)
    .maybeSingle();
  if (!room) notFound();

  const { rows, counts, total } = await listApplicationsForRoomWithClient(supabase, roomId);
  const property = Array.isArray(room.properties) ? room.properties[0] : room.properties;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/landlord/${slug}/listings`}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to listings
        </Link>
      </Button>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {room.name} <span className="text-muted-foreground">· {property?.name}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? 'No applicants yet.'
            : `${total} total applicants — ${counts.pending} pending, ${counts.accepted} accepted, ${counts.rejected} rejected.`}
        </p>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No applicants yet"
          description="Once tenants apply for this room, they show up here. You can keep the listing active or pause it any time."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Card className={row.status === 'accepted' ? 'border-success' : undefined}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {row.applicant_name ?? 'Applicant'}{' '}
                        <span className="text-xs font-normal text-muted-foreground">
                          · applied {new Date(row.applied_at).toLocaleDateString('en-GB')}
                        </span>
                      </CardTitle>
                      {row.applicant_contact_email ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" /> {row.applicant_contact_email}
                        </p>
                      ) : null}
                    </div>
                    <ApplicationStatusBadge status={row.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {row.message ? (
                    <p className="whitespace-pre-line rounded-md border bg-muted/30 p-3 text-sm">
                      {row.message}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No message provided.</p>
                  )}
                  {row.status === 'pending' ? (
                    <ApplicantActions
                      applicationId={row.id}
                      orgSlug={slug}
                      defaultRentPence={room.default_rent_pence ?? null}
                      defaultRentFrequency={room.default_rent_frequency ?? 'monthly'}
                    />
                  ) : null}
                  {row.status === 'rejected' && row.decline_reason ? (
                    <p className="text-xs text-muted-foreground">
                      Reason:{' '}
                      {isRoomFilledRejection(row)
                        ? 'Auto-rejected — room filled'
                        : row.decline_reason}
                    </p>
                  ) : null}
                  {row.status === 'accepted' && row.resulting_tenancy_id ? (
                    <Link
                      href={`/landlord/${slug}/tenancies/${row.resulting_tenancy_id}`}
                      className="text-xs text-primary underline"
                    >
                      View resulting tenancy
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
