import { PiggyBank } from 'lucide-react';
import { ComingSoonCard } from '@/components/ds/coming-soon-card';
import { PageHeader } from '@/components/ds/page-header';

type Params = { slug: string };

export default async function LandlordDepositsPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Deposits' },
        ]}
        title="Deposits register"
        description="One register, every protection certificate, every deadline tracked — coming soon."
      />
      <ComingSoonCard
        title="Deposits register"
        description="A landlord-side register of every tenancy deposit you hold — which scheme it's in, when it was protected, the unique reference, and a reminder before the prescribed-information deadline."
        bullets={[
          'DPS / TDS / mydeposits-scheme awareness',
          '30-day Prescribed Information deadline reminder',
          'Per-tenancy protection certificate upload',
          'Automatic check when a tenancy ends',
        ]}
        shipTarget="MVP+1"
        icon={<PiggyBank className="h-6 w-6" />}
        backHref={`/landlord/${slug}`}
      />
    </div>
  );
}
