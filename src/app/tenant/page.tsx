import { CreditCard, FileText, Inbox, Mail, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { Banner, SectionCard } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/core/utils/money';
import { EmergencyContacts } from '@/features/tenant-dashboard/components/emergency-contacts';
import { MaintenanceSnapshotList } from '@/features/tenant-dashboard/components/maintenance-snapshot';
import { NoticesList } from '@/features/tenant-dashboard/components/notices-card';
import { RecentPaymentsTimeline } from '@/features/tenant-dashboard/components/recent-payments-timeline';
import { ReportIssueButton } from '@/features/tenant-dashboard/components/report-issue-button';
import { TenancyDetailList } from '@/features/tenant-dashboard/components/tenancy-detail-list';
import { TenantRentHero } from '@/features/tenant-dashboard/components/tenant-rent-hero';
import { loadTenantDashboard } from '@/features/tenant-dashboard/load-tenant-dashboard';
import { loadTenantTenancyOptions } from '@/features/tickets/loaders';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * `/tenant` — tenant home dashboard.
 *
 * Single server component that loads everything via
 * `loadTenantDashboard` (one parallel fan-out) and renders the design's
 * two-column grid: rent hero across the top, then left col (Quick actions,
 * My home, My requests) and right col (Recent payments, Notices,
 * Emergency contacts).
 *
 * The "Report an issue" CTA opens a modal wrapping the same `NewTicketForm`
 * used by `/tenant/tickets/new`, so we don't duplicate the form code.
 */
export default async function TenantHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/tenant');

  const [dashboard, tenancyOptions] = await Promise.all([
    loadTenantDashboard(supabase, { userId: user.id, userEmail: user.email ?? null }),
    loadTenantTenancyOptions(user.id),
  ]);

  const { tenancy, rentHero, recentPayments, notices, maintenance, emergencyContact } = dashboard;

  // No active tenancy and no pending invites — empty-state home.
  if (!tenancy && dashboard.inviteCount === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header>
          <h1 className="font-sans text-[22px] font-bold tracking-tight text-ink">
            Hi {dashboard.firstName}, welcome to Tenantly
          </h1>
          <p className="mt-1 text-[13px] text-ink-light">
            Tenantly is <span className="font-semibold text-ink">free for tenants, forever</span>.
            Once your landlord invites you (or you accept a room on Listings), your home will appear
            here.
          </p>
        </header>
        <EmptyState
          icon={<Mail className="h-6 w-6" />}
          title="No active tenancies yet"
          description="Browse rooms or ask your landlord to send you an invite — once they do, your tenancy will appear here."
          cta={{ label: 'Browse listings', href: '/listings' }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* ── Greeting ─────────────────────────────────────────────────── */}
      <header>
        <h1 className="font-sans text-[22px] font-bold tracking-tight text-ink">
          Good {timeOfDay()}, {dashboard.firstName}
        </h1>
        {tenancy ? (
          <p className="mt-1 text-[13px] text-ink-light">
            {[tenancy.property.name, tenancy.roomName, tenancy.property.postcode]
              .filter(Boolean)
              .join(' · ')}
            {tenancy.endDate ? ` · Tenancy active until ${longDate(tenancy.endDate)}` : null}
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-ink-light">
            You have {dashboard.inviteCount} invite{dashboard.inviteCount === 1 ? '' : 's'} waiting
            below.
          </p>
        )}
      </header>

      {/* ── Pending invites banner ──────────────────────────────────── */}
      {dashboard.hasInvites ? (
        <Card className="border-amber-bg bg-amber-bg/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[14px]">
              <Inbox className="h-4 w-4 text-amber" />
              {dashboard.inviteCount === 1
                ? 'You have an invite waiting'
                : `${dashboard.inviteCount} invites waiting`}
            </CardTitle>
            <CardDescription>
              Open your invite link from the landlord&apos;s email to accept.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {/* ── Rent hero ────────────────────────────────────────────────── */}
      {tenancy && rentHero ? (
        <TenantRentHero hero={rentHero} tenancy={tenancy} monthLabel={dashboard.monthLabel} />
      ) : null}

      {/* ── Two column grid ─────────────────────────────────────────── */}
      {tenancy ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5">
          {/* Left column */}
          <div className="space-y-4 lg:space-y-5">
            <SectionCard title="Quick actions">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ReportIssueButton
                  tenancies={tenancyOptions}
                  redirectBase="/tenant/tickets"
                  className="w-full justify-center"
                />
                <Button asChild variant="outline" size="sm" className="w-full justify-center">
                  <Link href="/messages">
                    <MessageSquare className="h-4 w-4" />
                    Message landlord
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full justify-center">
                  <Link href="/tenant/documents">
                    <FileText className="h-4 w-4" />
                    My documents
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full justify-center">
                  <Link href={`/tenant/rent/${tenancy.id}`}>
                    <CreditCard className="h-4 w-4" />
                    Payment history
                  </Link>
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="My home">
              <TenancyDetailList
                rows={[
                  {
                    label: 'Property',
                    value: [
                      tenancy.property.addressLine1 ?? tenancy.property.name,
                      tenancy.property.city,
                      tenancy.property.postcode,
                    ]
                      .filter(Boolean)
                      .join(', '),
                  },
                  ...(tenancy.roomName ? [{ label: 'Room', value: tenancy.roomName }] : []),
                  {
                    label: 'Landlord',
                    value: (
                      <Link
                        href="/messages"
                        className="text-forest-700 hover:underline focus:outline-none focus:ring-2 focus:ring-forest-600/30"
                      >
                        {tenancy.landlord.displayName} →
                      </Link>
                    ),
                    emphasis: 'forest',
                  },
                  {
                    label: 'Monthly rent',
                    value: formatMoney(tenancy.rentPence).replace(/\.00$/, ''),
                  },
                  {
                    label: 'Rent due',
                    value: tenancy.rentDueDay
                      ? `${ordinal(tenancy.rentDueDay)} of the month`
                      : 'Monthly',
                  },
                  {
                    label: 'Tenancy start',
                    value: tenancy.startDate ? longDate(tenancy.startDate) : '—',
                  },
                  {
                    label: 'Tenancy end',
                    value: tenancy.endDate ? longDate(tenancy.endDate) : 'Periodic — no end date',
                  },
                  {
                    label: 'Deposit',
                    value: tenancy.depositScheme
                      ? `${formatMoney(tenancy.depositPence).replace(/\.00$/, '')} · ${tenancy.depositScheme.toUpperCase()} protected`
                      : formatMoney(tenancy.depositPence).replace(/\.00$/, ''),
                  },
                  {
                    label: 'Right to Rent',
                    value: 'Verified ✓',
                    emphasis: 'forest',
                  },
                ]}
              />
            </SectionCard>

            <SectionCard
              title="My requests"
              action={
                <Link
                  href="/tenant/tickets"
                  className="text-[12px] font-semibold text-forest-700 hover:underline"
                >
                  View all →
                </Link>
              }
            >
              <MaintenanceSnapshotList rows={maintenance} />
            </SectionCard>
          </div>

          {/* Right column */}
          <div className="space-y-4 lg:space-y-5">
            <SectionCard
              title="Recent payments"
              action={
                <Link
                  href={`/tenant/rent/${tenancy.id}`}
                  className="text-[12px] font-semibold text-forest-700 hover:underline"
                >
                  View all →
                </Link>
              }
            >
              <RecentPaymentsTimeline rows={recentPayments} />
            </SectionCard>

            <SectionCard title="Notices from landlord">
              <NoticesList notices={notices} />
            </SectionCard>

            <SectionCard title="Emergency contacts">
              <EmergencyContacts tenancy={tenancy} />
            </SectionCard>
          </div>
        </div>
      ) : null}

      {/* ── Personal next-of-kin reminder ──────────────────────────── */}
      {tenancy && !emergencyContact ? (
        <Banner
          tone="warn"
          title="Add an emergency contact"
          description="We don't have a next-of-kin on file for you. Add one from your profile so your landlord knows who to call."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/tenant/profile">Add now</Link>
            </Button>
          }
        />
      ) : null}
    </div>
  );
}

function timeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
