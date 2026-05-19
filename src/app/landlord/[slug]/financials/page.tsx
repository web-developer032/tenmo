import { BadgePoundSterling } from 'lucide-react';
import { ComingSoonCard } from '@/components/ds/coming-soon-card';
import { PageHeader } from '@/components/ds/page-header';

type Params = { slug: string };

/**
 * Stub for the upcoming "Financials & MTD" feature. Lives in the landlord
 * shell so the IA matches the design while the real feature ships in a
 * later phase.
 */
export default async function LandlordFinancialsPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Financials & MTD' },
        ]}
        title="Financials & MTD"
        description="Full P&L per property, Making Tax Digital filings, and HMRC-ready year-end packs — coming soon."
      />
      <ComingSoonCard
        title="Financials & MTD"
        description="A unified view of profit & loss per property and per portfolio, ready for HMRC and your accountant. Quarterly MTD filings built in."
        bullets={[
          'P&L per property and per portfolio',
          'Mortgage interest, insurance, repairs, agent fees',
          'Quarterly MTD filings to HMRC',
          'CSV + PDF export at year-end',
        ]}
        shipTarget="MVP+2"
        icon={<BadgePoundSterling className="h-6 w-6" />}
        backHref={`/landlord/${slug}`}
      />
    </div>
  );
}
