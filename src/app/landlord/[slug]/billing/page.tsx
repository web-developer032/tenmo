import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ds/page-header';
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
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Billing' },
        ]}
        title="Billing"
        description={
          <>
            Manage your subscription, payment method, and invoices for{' '}
            <strong className="text-ink">{org.name}</strong>.
          </>
        }
      />

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
