import { notFound } from 'next/navigation';
import { BillingView } from '@/features/billing/components/billing-view';
import { loadBillingFeed } from '@/features/billing/loaders';
import { resolveOrgBySlug } from '@/features/orgs/resolve';

type Params = { slug: string };
type Search = { status?: string };

export const dynamic = 'force-dynamic';

/**
 * Landlord billing page.
 *
 * Server-renders the org's current subscription + usage and hands them
 * to <BillingView> (client) for the monthly/annual toggle and Checkout
 * launch. Stripe redirects back here with `?status=success|cancelled`
 * which we surface as a flash banner.
 */
export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const { status } = await searchParams;
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const feed = await loadBillingFeed(org.id);
  const flashStatus =
    status === 'success' ? 'success' : status === 'cancelled' ? 'cancelled' : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <header className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your subscription, payment method, and invoices for <strong>{org.name}</strong>.
        </p>
      </header>

      <BillingView
        orgId={org.id}
        subscription={feed.subscription}
        usage={feed.usage}
        isOwner={org.role === 'owner'}
        flashStatus={flashStatus}
      />
    </div>
  );
}
