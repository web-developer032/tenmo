import { redirect } from 'next/navigation';
import { PageHeader, SectionCard } from '@/components/ds';
import { formatMoney } from '@/core/utils/money';
import { loadCurrentProfile } from '@/features/account/loaders';
import { loadNotificationPreferences } from '@/features/notifications/loaders';
import { TenancyDetailList } from '@/features/tenant-dashboard/components/tenancy-detail-list';
import { loadTenantDashboard } from '@/features/tenant-dashboard/load-tenant-dashboard';
import { EmergencyContactForm } from '@/features/tenant-profile/components/emergency-contact-form';
import { NotificationPrefsCard } from '@/features/tenant-profile/components/notification-prefs-card';
import { PersonalDetailsForm } from '@/features/tenant-profile/components/personal-details-form';
import { SecurityCard } from '@/features/tenant-profile/components/security-card';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * `/tenant/profile` — tenant "My Profile" page.
 *
 * Two-column layout (mirrors the HMOeez design):
 *   - Left:  Personal details + Emergency contact (write-through)
 *   - Right: My tenancy (read-only summary) + Security + Notification prefs
 *
 * All four sections live as feature components under
 * `features/tenant-profile/components/*` so future tweaks don't bloat this
 * page file. Data is loaded server-side via the existing loaders so we
 * don't have to invent new RPCs — `loadCurrentProfile` for personal /
 * emergency / notification prefs, `loadTenantDashboard` for the tenancy
 * summary.
 */
export default async function TenantProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/tenant/profile');

  const [profile, prefs, dashboard] = await Promise.all([
    loadCurrentProfile(),
    loadNotificationPreferences(),
    loadTenantDashboard(supabase, { userId: user.id, userEmail: user.email ?? null }),
  ]);

  if (!profile) redirect('/login?redirect=/tenant/profile');

  const tenancy = dashboard.tenancy;
  const initials = dashboard.initials;

  const tenancyRows = tenancy
    ? [
        {
          label: 'Property',
          value: [tenancy.property.name, tenancy.property.addressLine1, tenancy.property.postcode]
            .filter(Boolean)
            .join(', '),
        },
        {
          label: 'Room',
          value: tenancy.roomName ?? null,
        },
        {
          label: 'Landlord',
          value: tenancy.landlord.displayName,
          emphasis: 'forest' as const,
        },
        {
          label: 'Tenancy type',
          value: 'Assured Shorthold Tenancy',
        },
        {
          label: 'Start date',
          value: tenancy.startDate
            ? new Date(tenancy.startDate).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : null,
        },
        {
          label: 'End date',
          value: tenancy.endDate
            ? new Date(tenancy.endDate).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : 'Periodic',
        },
        {
          label: 'Monthly rent',
          value: tenancy.rentPence > 0 ? formatMoney(tenancy.rentPence).replace(/\.00$/, '') : null,
        },
        {
          label: 'Deposit',
          value:
            tenancy.depositPence > 0
              ? [
                  formatMoney(tenancy.depositPence).replace(/\.00$/, ''),
                  tenancy.depositScheme ? `${tenancy.depositScheme.toUpperCase()} protected` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : null,
        },
        {
          label: 'Payment reference',
          value: tenancy.paymentReference,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="Manage your account and personal details" />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left column */}
        <div className="flex flex-col gap-5">
          <SectionCard title="Personal details">
            <PersonalDetailsForm initial={profile} initials={initials} />
          </SectionCard>

          <SectionCard title="Emergency contact">
            <EmergencyContactForm initial={profile} />
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          <SectionCard title="My tenancy">
            {tenancy ? (
              <TenancyDetailList rows={tenancyRows} />
            ) : (
              <p className="py-2 text-[13px] text-ink-light">
                You don&apos;t have an active tenancy yet. Once your landlord invites you, your
                tenancy details will appear here.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Security">
            <SecurityCard />
          </SectionCard>

          <SectionCard title="Notification preferences">
            {prefs ? (
              <NotificationPrefsCard initial={prefs} />
            ) : (
              <p className="py-2 text-[13px] text-ink-light">
                Preferences are unavailable right now.
              </p>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
