import { notFound, redirect } from 'next/navigation';
import { DdCallbackHandler } from '@/features/payments/components/dd-callback-handler';
import { createClient } from '@/lib/supabase/server';

type Params = { tenancyId: string };
type SearchParams = { redirect_flow_id?: string };

export const dynamic = 'force-dynamic';

/**
 * GoCardless redirects the tenant back here after they enter their
 * bank details on the GC hosted form. Query string carries
 * `redirect_flow_id`. The client component takes over from there:
 * it POSTs the flow id to our `/complete` endpoint, which calls GC
 * to finalise + persists the resulting mandate.
 *
 * The server component just verifies the tenant owns this tenancy
 * (defence in depth on top of RLS) and renders the client handler.
 */
export default async function DdCallbackPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { tenancyId } = await params;
  const { redirect_flow_id } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/tenant/rent/${tenancyId}/dd-callback`);

  const { data: tenancy, error } = await supabase
    .from('tenancies')
    .select('id, tenant_user_id')
    .eq('id', tenancyId)
    .maybeSingle();
  if (error) throw error;
  if (!tenancy || tenancy.tenant_user_id !== user.id) notFound();

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-10 md:px-8">
      <h1 className="text-2xl font-semibold">Direct Debit setup</h1>
      <DdCallbackHandler tenancyId={tenancyId} redirectFlowId={redirect_flow_id ?? null} />
    </div>
  );
}
