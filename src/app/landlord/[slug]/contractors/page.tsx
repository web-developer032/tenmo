import { HardHat } from 'lucide-react';
import { ComingSoonCard } from '@/components/ds/coming-soon-card';
import { PageHeader } from '@/components/ds/page-header';

type Params = { slug: string };

export default async function LandlordContractorsPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Contractors' },
        ]}
        title="Contractors directory"
        description="Your trusted gas engineers, electricians, cleaners and handypeople — coming soon."
      />
      <ComingSoonCard
        title="Contractors directory"
        description="A per-org address book of contractors with trades, certifications, insurance docs, and rate cards. Maintenance tickets and compliance renewals will plug into this directly so dispatch is one click."
        bullets={[
          'Trade tags (gas, electric, plumbing, cleaning)',
          'Gas Safe / NICEIC / Part-P certification store',
          'Insurance document expiry tracking',
          'One-click assign from a maintenance ticket',
        ]}
        shipTarget="MVP+2"
        icon={<HardHat className="h-6 w-6" />}
        backHref={`/landlord/${slug}`}
      />
    </div>
  );
}
