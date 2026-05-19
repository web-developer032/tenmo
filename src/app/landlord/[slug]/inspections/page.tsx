import { ClipboardList } from 'lucide-react';
import { ComingSoonCard } from '@/components/ds/coming-soon-card';
import { PageHeader } from '@/components/ds/page-header';

type Params = { slug: string };

export default async function LandlordInspectionsPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Inspections' },
        ]}
        title="Inspections"
        description="Schedule periodic inspections, capture findings on-site, and notify your tenants 24+ hours ahead — coming soon."
      />
      <ComingSoonCard
        title="Inspections"
        description="A built-in schedule for periodic property inspections, with room-by-room checklists, photo evidence, and an automated 24-hour notice email to the tenant — keeping you on the right side of the Renters' Rights Bill."
        bullets={[
          'Quarterly / half-yearly / annual cadence',
          'Per-room checklist with photos',
          '24-hour notice email to tenant (RRB-compliant)',
          'Action items routed into maintenance tickets',
        ]}
        shipTarget="MVP+2"
        icon={<ClipboardList className="h-6 w-6" />}
        backHref={`/landlord/${slug}`}
      />
    </div>
  );
}
