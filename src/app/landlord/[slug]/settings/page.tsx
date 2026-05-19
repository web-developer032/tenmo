import { ArrowRight, Building2, CreditCard, Mail, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KV } from '@/components/common/kv';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { OrgRole } from '@/core/schemas/org';
import { formatShortDate } from '@/core/utils/dates';
import { loadOrgDetail, loadOrgMembers, type OrgMember } from '@/features/orgs/loaders';
import { resolveOrgBySlug } from '@/features/orgs/resolve';

type Params = { slug: string };

export const dynamic = 'force-dynamic';

/**
 * `/landlord/[slug]/settings` — landlord-side settings hub.
 *
 * MVP scope is read-only:
 *   - Organisation profile (name, slug, contact, address, VAT/company number)
 *   - Active members + roles (sourced via the shared `loadOrgMembers` loader
 *     so every page agrees on what "an org member" means)
 *   - Cross-links to billing + per-user account settings
 *
 * Editing the org profile and inviting/removing members ships in MVP+1 and
 * will land here as additional cards / forms; the layout is one-card-per-area
 * so it scales without redesign.
 */
export default async function LandlordSettingsPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const [detail, members] = await Promise.all([loadOrgDetail(org.id), loadOrgMembers(org.id)]);
  if (!detail) notFound();

  const addressLines = formatBusinessAddress(detail.business_address);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Tenantly', href: '/dispatch' },
          { label: 'Landlord', href: `/landlord/${slug}` },
          { label: 'Settings' },
        ]}
        title="Settings"
        description={
          <>
            Manage organisation details, members and billing for{' '}
            <strong className="text-ink">{detail.name}</strong>.
          </>
        }
      />

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Organisation profile
          </CardTitle>
          <CardDescription>
            Used on tenancy agreements, invoices and tenant communications. Editing is coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <KV label="Business name" value={detail.name} />
          <KV label="URL slug" value={detail.slug} />
          <KV label="Contact email" value={detail.contact_email} />
          <KV label="Contact phone" value={detail.contact_phone} />
          <KV label="Companies House no." value={detail.company_number} />
          <KV label="VAT number" value={detail.vat_number} />
          <KV label="Created" value={formatShortDate(detail.created_at)} />
          <div className="border-t pt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Business address
            </div>
            {addressLines.length === 0 ? (
              <div className="pt-1 text-sm text-muted-foreground">—</div>
            ) : (
              <div className="pt-1 text-sm">
                {addressLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-muted-foreground" />
            Members ({members.length})
          </CardTitle>
          <CardDescription>
            Everyone with active access to {detail.name}. Inviting, role changes and revocation ship
            next.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {members.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No active members yet.
            </div>
          ) : (
            <ul className="divide-y">
              {members.map((m) => (
                <MemberRow key={m.user_id} member={m} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ResponsiveGrid preset="cards-2">
        <SettingsLinkCard
          href={`/landlord/${slug}/billing`}
          icon={<CreditCard className="h-4 w-4 text-forest-600" />}
          title="Billing & subscription"
          description="Plan, payment method, invoices and usage. Owners only can change the plan."
        />
        <SettingsLinkCard
          href="/account/settings"
          icon={<ShieldCheck className="h-4 w-4 text-forest-600" />}
          title="Personal account"
          description="Notification preferences, profile and password. Applies across every workspace you belong to."
        />
      </ResponsiveGrid>
    </div>
  );
}

function MemberRow({ member }: { member: OrgMember }) {
  const displayName = member.full_name?.trim() || member.contact_email || 'Unnamed member';
  const joined = member.accepted_at ?? member.created_at;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0 space-y-0.5">
        <div className="truncate font-medium">{displayName}</div>
        {member.contact_email ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" />
            <span className="truncate">{member.contact_email}</span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RoleBadge role={member.role} />
        {joined ? <span>joined {formatShortDate(joined)}</span> : null}
      </div>
    </li>
  );
}

function RoleBadge({ role }: { role: OrgRole }) {
  const variant: 'active' | 'warning' | 'neutral' =
    role === 'owner' ? 'active' : role === 'agent' ? 'warning' : 'neutral';
  return (
    <Badge variant={variant} className="capitalize">
      {role}
    </Badge>
  );
}

function SettingsLinkCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full transition hover:border-forest-200 hover:bg-foam/40">
        <CardHeader>
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-ink-light" />
        </CardHeader>
      </Card>
    </Link>
  );
}

/**
 * Format the org's `business_address` jsonb into a list of display lines.
 * Returns `[]` when the address is null/empty so callers can render a
 * single em-dash placeholder instead of "—" lines.
 */
function formatBusinessAddress(address: unknown): string[] {
  if (!address || typeof address !== 'object') return [];
  const a = address as {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    postcode?: string | null;
    country?: string | null;
  };
  const lines: string[] = [];
  if (a.line1) lines.push(a.line1);
  if (a.line2) lines.push(a.line2);
  const cityLine = [a.city, a.postcode].filter(Boolean).join(' · ');
  if (cityLine) lines.push(cityLine);
  if (a.country && a.country !== 'GB') lines.push(a.country);
  return lines;
}
