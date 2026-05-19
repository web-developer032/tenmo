import { ScrollText } from 'lucide-react';
import { ComingSoonCard } from '@/components/ds/coming-soon-card';
import { PageHeader } from '@/components/ds/page-header';

type Params = { slug: string };

export default async function LandlordRightToRentPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Right to Rent' },
        ]}
        title="Right to Rent register"
        description="Per-tenant Right to Rent checks, evidence storage, and follow-up scheduling — coming soon."
      />
      <ComingSoonCard
        title="Right to Rent register"
        description="Section 22 of the Immigration Act 2014 makes you responsible for verifying every adult occupier's right to rent. Tenantly will track each check, store the evidence, and remind you when a time-limited right is about to expire."
        bullets={[
          'Per-occupier check + evidence upload',
          'Time-limited right reminders (12-month follow-up)',
          'Manual + Home Office digital check support',
          'Audit-ready export per property',
        ]}
        shipTarget="MVP+1"
        icon={<ScrollText className="h-6 w-6" />}
        backHref={`/landlord/${slug}`}
      />
    </div>
  );
}
