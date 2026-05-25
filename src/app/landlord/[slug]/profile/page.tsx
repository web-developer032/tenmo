import { KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/ds/page-header';
import { SectionCard } from '@/components/ds/section-card';
import { Button } from '@/components/ui/button';
import { loadCurrentProfile } from '@/features/account/loaders';
import { BusinessDetailsForm } from '@/features/landlord-profile/components/business-details-form';
import { PersonalDetailsForm } from '@/features/landlord-profile/components/personal-details-form';
import { loadOrgDetail } from '@/features/orgs/loaders';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { createClient } from '@/lib/supabase/server';

type Params = { slug: string };

export const dynamic = 'force-dynamic';

/**
 * `/landlord/[slug]/profile` — the calling user's profile combined with the
 * org's business details, plan summary and security shortcuts. Mirrors the
 * HMOeez design: a single editable "Personal details" column on the left
 * and a stacked column on the right with Business / Plan & billing / Security
 * cards.
 */
export default async function LandlordProfilePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const supabase = await createClient();
  const [profile, detail, { data: membership }, { count: propertyCount }] = await Promise.all([
    loadCurrentProfile(),
    loadOrgDetail(org.id),
    supabase
      .from('org_memberships')
      .select('role')
      .eq('org_id', org.id)
      .is('revoked_at', null)
      .maybeSingle(),
    supabase.from('properties').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
  ]);

  if (!profile) redirect(`/login?redirect=/landlord/${slug}/profile`);
  if (!detail) notFound();

  const isOwner = membership?.role === 'owner';
  const initials = deriveInitials(profile.full_name ?? profile.email);

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'My Profile' },
        ]}
        title="My Profile"
        description="Manage your account information and preferences"
      />

      <div className="grid grid-cols-1 gap-4 lg:max-w-5xl lg:grid-cols-[1.1fr_1fr] lg:gap-5">
        <SectionCard title="Personal details">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-foam text-[18px] font-bold text-forest-700">
              {initials}
            </div>
            <Button variant="ghost" size="sm" disabled>
              Change photo
            </Button>
          </div>
          <PersonalDetailsForm
            initial={{
              full_name: profile.full_name,
              preferred_name: profile.preferred_name,
              contact_email: profile.contact_email ?? profile.email,
              contact_phone: profile.contact_phone,
            }}
          />
        </SectionCard>

        <div className="flex flex-col gap-4">
          <SectionCard title="Business details">
            {isOwner ? (
              <BusinessDetailsForm
                slug={slug}
                initial={{
                  name: detail.name,
                  vat_number: detail.vat_number ?? null,
                  company_number: detail.company_number ?? null,
                  contact_email: detail.contact_email ?? null,
                  contact_phone: detail.contact_phone ?? null,
                }}
              />
            ) : (
              <dl className="space-y-2 text-[13px]">
                <Row label="Trading name" value={detail.name} />
                <Row label="Company number" value={detail.company_number ?? '—'} />
                <Row label="VAT number" value={detail.vat_number ?? '—'} />
                <Row label="Business email" value={detail.contact_email ?? '—'} />
                <Row label="Business phone" value={detail.contact_phone ?? '—'} />
                <p className="pt-2 text-[12px] text-ink-light">
                  Only an organisation owner can edit business details.
                </p>
              </dl>
            )}
          </SectionCard>

          <SectionCard title="Plan & billing">
            <div className="flex items-center justify-between rounded-card bg-forest-600 px-4 py-3.5 text-white">
              <div>
                <div className="font-sans text-[15px] font-bold">Pro Plan</div>
                <div className="text-[12px] text-mint">Up to 20 properties · £29/mo</div>
              </div>
              <Button
                asChild
                variant="ghost"
                className="border-white/40 text-white hover:bg-white/10"
              >
                <Link href={`/landlord/${slug}/billing`}>Manage</Link>
              </Button>
            </div>
            <Row label="Next billing date" value="—" />
            <Row label="Properties used" value={`${propertyCount ?? 0} / 20`} />
          </SectionCard>

          <SectionCard title="Security">
            <div className="space-y-2">
              <Button asChild variant="ghost" className="w-full justify-center">
                <Link href="/account/security">
                  <KeyRound className="h-4 w-4" /> Change password
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full justify-center">
                <Link href="/account/security">
                  <ShieldOff className="h-4 w-4" /> Enable two-factor auth
                </Link>
              </Button>
              <div className="flex items-center gap-2 rounded-card bg-foam px-3 py-2 text-[12px] text-forest-700">
                <ShieldCheck className="h-4 w-4" /> Signed in as {profile.email}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border-soft py-2 last:border-b-0">
      <span className="text-[12px] text-ink-light">{label}</span>
      <span className="font-sans text-[13px] font-bold text-ink">{value}</span>
    </div>
  );
}

function deriveInitials(source: string | null): string {
  if (!source) return 'ME';
  const trimmed = source.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? '';
    const b = parts[1]?.[0] ?? '';
    return `${a}${b}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}
