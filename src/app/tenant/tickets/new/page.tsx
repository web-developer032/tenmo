import { ArrowLeft, Wrench } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NewTicketForm } from '@/features/tickets/components/new-ticket-form';
import { loadTenantTenancyOptions } from '@/features/tickets/loaders';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewTenantTicketPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/tenant/tickets/new');

  const tenancies = await loadTenantTenancyOptions(user.id);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 md:px-8 md:py-8">
      <div>
        <Link
          href="/tenant/tickets"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to maintenance
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Raise an issue</h1>
        <p className="text-sm text-muted-foreground">
          Tell your landlord what's going on. Be specific — when did it start, how often does it
          happen, and is it dangerous? You can attach photos or a short video below.
        </p>
      </header>

      {tenancies.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-6 w-6" />}
          title="No active tenancy"
          description="You'll be able to raise issues once your tenancy is active. If you've been invited, accept the invite from your dashboard first."
          cta={{ label: 'Go to dashboard', href: '/tenant' }}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New maintenance ticket</CardTitle>
            <CardDescription>
              Your landlord will see this immediately. Tenantly is{' '}
              <span className="font-medium text-foreground">free for tenants</span> — always.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewTicketForm tenancies={tenancies} redirectBase="/tenant/tickets" />
          </CardContent>
        </Card>
      )}

      <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        <strong className="font-medium text-foreground">Emergency?</strong> If there's an immediate
        risk (gas leak, fire, flooding, no heat in winter), call your landlord directly first, then
        log it here for the record.{' '}
        <Button asChild variant="link" size="sm" className="h-auto px-1 py-0 text-xs">
          <Link href="/tenant">Find your landlord's contact</Link>
        </Button>
      </p>
    </div>
  );
}
